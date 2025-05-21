import crypto from 'crypto';
import Wallet from '../../models/wallet.js';
import Branch from '../../models/branch.js';

// Use environment variables for Razorpay configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Check if keys are configured
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error('Razorpay keys not found in environment variables');
}

/**
 * Creates a new Razorpay order
 */
export const createRazorpayOrder = async (request, reply) => {
  try {
    const { branchId } = request.params;
    const { amount } = request.body;
    
    // Validate amount (frontend sends amount in rupees)
    if (!amount || amount < 30) { // Minimum amount is 30 INR
      return reply.status(400).send({ 
        success: false, 
        error: "Amount must be at least 30 INR" 
      });
    }
    
    // Get branch details for receipt generation
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ 
        success: false, 
        error: "Branch not found" 
      });
    }
    
    // Create order in Razorpay with a receipt that respects the 40-char limit
    // Generate a shorter receipt ID that won't exceed Razorpay's 40 character limit
    const shortBranchId = branchId.toString().substring(0, 8);
    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp (seconds) is shorter
    let receipt = `w-${shortBranchId}-${timestamp}`;
    
    // Validate receipt length to ensure it's under Razorpay's limit
    if (receipt.length > 40) {
      request.log.warn({
        msg: "Receipt too long, using fallback format",
        receiptLength: receipt.length
      });
      // Fallback to an even shorter format if still too long
      receipt = `w-${shortBranchId}-${Date.now() % 1000000}`;
    }
    
    const orderOptions = {
      amount: amount * 100, // Amount in paisa (Razorpay uses smallest currency unit)
      currency: 'INR',
      receipt: receipt,
      notes: {
        branchId: branchId,
        branchName: branch.name,
        branchPhone: branch.phone
      }
    };
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`
      },
      body: JSON.stringify(orderOptions)
    });
    
    const data = await response.json();
    
    if (!data.id) {
      request.log.error({
        msg: "Error creating Razorpay order",
        error: data
      });
      return reply.status(500).send({ 
        success: false, 
        error: "Failed to create order" 
      });
    }
    
    // Return order details needed for checkout
    return reply.status(200).send({
      success: true,
      order: {
        id: data.id,
        amount: data.amount,
        currency: data.currency,
        key: RAZORPAY_KEY_ID
      },
      branch: {
        name: branch.name,
        email: branch.email || '',
        phone: branch.phone
      }
    });
    
  } catch (error) {
    request.log.error({
      msg: "Error in createRazorpayOrder",
      error: error.message
    });
    return reply.status(500).send({ 
      success: false, 
      error: "Server error while creating order" 
    });
  }
};

/**
 * Verifies payment signature and updates wallet balance
 */
export const verifyPayment = async (request, reply) => {
  try {
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature,
      branchId,
      amount
    } = request.body;
    
    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    
    if (generatedSignature !== razorpay_signature) {
      return reply.status(400).send({ 
        success: false, 
        error: "Invalid payment signature" 
      });
    }
    
    // Get payment details from Razorpay to double-check
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`
      }
    });
    
    const paymentData = await response.json();
    
    // Ensure payment was successful
    if (paymentData.status !== 'captured') {
      return reply.status(400).send({ 
        success: false, 
        error: "Payment not completed successfully" 
      });
    }
    
    // Create transaction and update wallet balance
    const transaction = {
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      amount: parseInt(amount) / 100, // Convert from paisa to rupees
      type: "payment",
      timestamp: new Date()
    };
    
    // Using findOneAndUpdate with $inc for atomic operation
    const updatedWallet = await Wallet.findOneAndUpdate(
      { branchId },
      {
        $inc: { balance: parseInt(amount) / 100 }, // Add amount to balance
        $push: { transactions: transaction }
      },
      {
        new: true, // Return updated document
        upsert: true, // Create if doesn't exist
        setDefaultsOnInsert: true
      }
    );
    
    // Success!
    return reply.status(200).send({
      success: true,
      message: "Payment verified and wallet updated",
      transaction: transaction,
      newBalance: updatedWallet.balance
    });
    
  } catch (error) {
    request.log.error({
      msg: "Error in verifyPayment",
      error: error.message
    });
    return reply.status(500).send({ 
      success: false, 
      error: "Server error while verifying payment" 
    });
  }
};

/**
 * Handles Razorpay webhook events
 */
export const handleWebhook = async (request, reply) => {
  try {
    // Verify webhook signature
    const webhookSignature = request.headers['x-razorpay-signature'];
    const webhookBody = JSON.stringify(request.body);
    
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');
    
    if (expectedSignature !== webhookSignature) {
      request.log.error('Invalid webhook signature');
      return reply.status(400).send({ error: 'Invalid signature' });
    }
    
    const event = request.body;
    
    // Handle payment.captured event
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const notes = payment.notes || {};
      const branchId = notes.branchId;
      
      if (!branchId) {
        request.log.error('Missing branchId in payment notes');
        return reply.status(400).send({ error: 'Missing branchId' });
      }
      
      // Create transaction and update wallet
      const transaction = {
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id,
        amount: payment.amount / 100, // Convert from paisa to rupees
        type: "payment",
        timestamp: new Date()
      };
      
      await Wallet.findOneAndUpdate(
        { branchId },
        {
          $inc: { balance: payment.amount / 100 },
          $push: { transactions: transaction }
        },
        {
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
      
      request.log.info(`Webhook: Updated wallet for branch ${branchId}`);
    }
    
    return reply.status(200).send({ success: true });
    
  } catch (error) {
    request.log.error({
      msg: "Error in handleWebhook",
      error: error.message
    });
    return reply.status(500).send({ error: 'Server error' });
  }
};

/**
 * Gets payment status from Razorpay
 */
export const getPaymentStatus = async (request, reply) => {
  try {
    const { paymentId } = request.params;
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`
      }
    });
    
    const paymentData = await response.json();
    
    return reply.status(200).send({
      success: true,
      payment: {
        id: paymentData.id,
        amount: paymentData.amount / 100,
        status: paymentData.status,
        method: paymentData.method,
        created_at: paymentData.created_at
      }
    });
    
  } catch (error) {
    request.log.error({
      msg: "Error getting payment status",
      error: error.message
    });
    return reply.status(500).send({ 
      success: false, 
      error: "Server error while fetching payment" 
    });
  }
};
