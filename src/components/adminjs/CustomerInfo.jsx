import React, { useState, useEffect } from "react";
import {
  Box,
  H3,
  Text,
  Button,
  Loader,
  Badge,
  Table,
  Link,
} from "@adminjs/design-system";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const CustomerInfo = (props) => {
  const { record: { params } = {} } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customerData, setCustomerData] = useState(null);

  const customerId = params.id;

  const fetchCustomerInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.resourceAction({
        resourceId: "Customer",
        actionName: "getCustomerDetails",
        params: { customerId },
      });

      if (response.data) {
        setCustomerData(response.data);
      } else {
        setError("No data returned from the server");
      }
    } catch (err) {
      setError(err.message || "Failed to fetch customer information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchCustomerInfo();
    }
  }, [customerId]);

  if (loading) {
    return (
      <Box>
        <Loader />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text>{error}</Text>
        <Button onClick={fetchCustomerInfo} mt="default">
          Retry
        </Button>
      </Box>
    );
  }

  if (!customerData) {
    return (
      <Box>
        <Text>No information available for this customer</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="xl"
      >
        <Box>
          <H3>{customerData.name}</H3>
          <Text size="lg" color="grey">
            Customer since{" "}
            {new Date(customerData.createdAt).toLocaleDateString()}
          </Text>
        </Box>
        <Badge size="lg" variant={customerData.isActive ? "success" : "danger"}>
          {customerData.isActive ? "Active" : "Inactive"}
        </Badge>
      </Box>

      {/* Contact Information */}
      <Box
        p="lg"
        mb="xl"
        style={{ border: "1px solid #eee", borderRadius: "10px" }}
      >
        <H3 mb="lg">Contact Information</H3>
        <Box
          display="flex"
          flexDirection={["column", "column", "row"]}
          flexWrap="wrap"
        >
          <Box width={[1, 1, 1 / 2]} pr={[0, 0, "lg"]} mb="lg">
            <Text fontWeight="bold" mb="sm">
              Email
            </Text>
            <Text mb="lg">{customerData.email || "Not provided"}</Text>

            <Text fontWeight="bold" mb="sm">
              Phone
            </Text>
            <Text mb="lg">{customerData.phone || "Not provided"}</Text>
          </Box>

          <Box width={[1, 1, 1 / 2]}>
            <Text fontWeight="bold" mb="sm">
              Default Shipping Address
            </Text>
            {customerData.defaultShippingAddress ? (
              <>
                <Text mb="sm">{customerData.defaultShippingAddress.name}</Text>
                <Text mb="sm">{customerData.defaultShippingAddress.line1}</Text>
                {customerData.defaultShippingAddress.line2 && (
                  <Text mb="sm">
                    {customerData.defaultShippingAddress.line2}
                  </Text>
                )}
                <Text mb="sm">
                  {customerData.defaultShippingAddress.city},{" "}
                  {customerData.defaultShippingAddress.state}{" "}
                  {customerData.defaultShippingAddress.postalCode}
                </Text>
                <Text mb="sm">
                  {customerData.defaultShippingAddress.country}
                </Text>
              </>
            ) : (
              <Text>No default shipping address set</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Account Details */}
      <Box
        p="lg"
        mb="xl"
        style={{ border: "1px solid #eee", borderRadius: "10px" }}
      >
        <H3 mb="lg">Account Details</H3>
        <Box
          display="flex"
          flexDirection={["column", "column", "row"]}
          flexWrap="wrap"
        >
          <Box width={[1, 1, 1 / 3]} pr={[0, 0, "lg"]} mb="lg">
            <Text fontWeight="bold" mb="sm">
              Customer ID
            </Text>
            <Text mb="lg">{customerData.id}</Text>

            <Text fontWeight="bold" mb="sm">
              Account Type
            </Text>
            <Text mb="lg">{customerData.accountType || "Standard"}</Text>
          </Box>

          <Box width={[1, 1, 1 / 3]} pr={[0, 0, "lg"]} mb="lg">
            <Text fontWeight="bold" mb="sm">
              Registration Date
            </Text>
            <Text mb="lg">
              {new Date(customerData.createdAt).toLocaleDateString()}
            </Text>

            <Text fontWeight="bold" mb="sm">
              Last Login
            </Text>
            <Text mb="lg">
              {customerData.lastLogin
                ? new Date(customerData.lastLogin).toLocaleString()
                : "Never"}
            </Text>
          </Box>

          <Box width={[1, 1, 1 / 3]}>
            <Text fontWeight="bold" mb="sm">
              Total Orders
            </Text>
            <Text mb="lg">{customerData.totalOrders || 0}</Text>

            <Text fontWeight="bold" mb="sm">
              Lifetime Value
            </Text>
            <Text mb="lg">
              ${customerData.lifetimeValue?.toFixed(2) || "0.00"}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Recent Orders */}
      {customerData.recentOrders && customerData.recentOrders.length > 0 && (
        <Box
          p="lg"
          mb="xl"
          style={{ border: "1px solid #eee", borderRadius: "10px" }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb="lg"
          >
            <H3>Recent Orders</H3>
            <Button
              as="a"
              href={`/admin/resources/Order?filters.customerId=${customerId}`}
              size="sm"
              variant="primary"
            >
              View All Orders
            </Button>
          </Box>

          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Cell>Order #</Table.Cell>
                <Table.Cell>Date</Table.Cell>
                <Table.Cell>Status</Table.Cell>
                <Table.Cell>Total</Table.Cell>
                <Table.Cell>Action</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {customerData.recentOrders.map((order, index) => (
                <Table.Row key={index}>
                  <Table.Cell>{order.orderNumber}</Table.Cell>
                  <Table.Cell>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="sm"
                      variant={
                        order.status === "Delivered" ||
                        order.status === "Shipped"
                          ? "success"
                          : order.status === "Processing"
                          ? "primary"
                          : order.status === "Cancelled"
                          ? "danger"
                          : "light"
                      }
                    >
                      {order.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>${order.totalAmount?.toFixed(2)}</Table.Cell>
                  <Table.Cell>
                    <Button
                      as="a"
                      href={`/admin/resources/Order/records/${order.id}/show`}
                      size="sm"
                      variant="text"
                    >
                      View
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Box>
      )}

      {/* Saved Payment Methods */}
      {customerData.paymentMethods &&
        customerData.paymentMethods.length > 0 && (
          <Box
            p="lg"
            mb="xl"
            style={{ border: "1px solid #eee", borderRadius: "10px" }}
          >
            <H3 mb="lg">Payment Methods</H3>

            <Box display="flex" flexWrap="wrap">
              {customerData.paymentMethods.map((payment, index) => (
                <Box
                  key={index}
                  width={[1, 1 / 2, 1 / 3]}
                  p="md"
                  mb="md"
                  mr={["0", "md", "md"]}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: "5px",
                    backgroundColor: payment.isDefault ? "#f9f9f9" : "white",
                  }}
                >
                  <Box display="flex" justifyContent="space-between" mb="md">
                    <Text fontWeight="bold">
                      {payment.cardType} •••• {payment.last4}
                    </Text>
                    {payment.isDefault && (
                      <Badge size="sm" variant="primary">
                        Default
                      </Badge>
                    )}
                  </Box>
                  <Text mb="sm">
                    Expires: {payment.expiryMonth}/{payment.expiryYear}
                  </Text>
                  <Text>{payment.billingName}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        )}

      {/* Additional Addresses */}
      {customerData.addresses && customerData.addresses.length > 0 && (
        <Box
          p="lg"
          mb="xl"
          style={{ border: "1px solid #eee", borderRadius: "10px" }}
        >
          <H3 mb="lg">Saved Addresses</H3>

          <Box display="flex" flexWrap="wrap">
            {customerData.addresses.map((address, index) => (
              <Box
                key={index}
                width={[1, 1 / 2, 1 / 3]}
                p="md"
                mb="md"
                mr={["0", "md", "md"]}
                style={{
                  border: "1px solid #eee",
                  borderRadius: "5px",
                  backgroundColor: address.isDefault ? "#f9f9f9" : "white",
                }}
              >
                <Box display="flex" justifyContent="space-between" mb="md">
                  <Text fontWeight="bold">{address.name}</Text>
                  {address.isDefault && (
                    <Badge size="sm" variant="primary">
                      Default
                    </Badge>
                  )}
                </Box>
                <Text mb="sm">{address.line1}</Text>
                {address.line2 && <Text mb="sm">{address.line2}</Text>}
                <Text mb="sm">
                  {address.city}, {address.state} {address.postalCode}
                </Text>
                <Text mb="sm">{address.country}</Text>
                {address.phone && <Text mb="sm">Phone: {address.phone}</Text>}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Activity Log */}
      {customerData.activityLog && customerData.activityLog.length > 0 && (
        <Box
          p="lg"
          mb="xl"
          style={{ border: "1px solid #eee", borderRadius: "10px" }}
        >
          <H3 mb="lg">Activity Log</H3>

          <Box>
            {customerData.activityLog.map((activity, index) => (
              <Box
                key={index}
                mb="md"
                p="md"
                style={{
                  borderBottom:
                    index < customerData.activityLog.length - 1
                      ? "1px solid #eee"
                      : "none",
                }}
              >
                <Box display="flex" justifyContent="space-between" mb="sm">
                  <Text fontWeight="bold">{activity.action}</Text>
                  <Text color="grey">
                    {new Date(activity.timestamp).toLocaleString()}
                  </Text>
                </Box>
                <Text>{activity.description}</Text>
                {activity.details && (
                  <Text mt="sm" size="sm" color="grey">
                    {activity.details}
                  </Text>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Notes */}
      <Box
        p="lg"
        mb="xl"
        style={{ border: "1px solid #eee", borderRadius: "10px" }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb="lg"
        >
          <H3>Customer Notes</H3>
          <Button
            onClick={() => {
              /* Handle adding new note */
            }}
            size="sm"
            variant="primary"
          >
            Add Note
          </Button>
        </Box>

        {customerData.notes && customerData.notes.length > 0 ? (
          customerData.notes.map((note, index) => (
            <Box
              key={index}
              mb="lg"
              p="md"
              style={{ backgroundColor: "#f9f9f9", borderRadius: "5px" }}
            >
              <Box display="flex" justifyContent="space-between" mb="sm">
                <Text fontWeight="bold">{note.createdBy}</Text>
                <Text color="grey">
                  {new Date(note.createdAt).toLocaleString()}
                </Text>
              </Box>
              <Text>{note.content}</Text>
            </Box>
          ))
        ) : (
          <Text>No notes have been added for this customer.</Text>
        )}
      </Box>
    </Box>
  );
};

export default CustomerInfo;
