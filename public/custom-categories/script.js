document.addEventListener('DOMContentLoaded', () => {
    // Step 1: Category Name
    const categoryNameForm = document.getElementById('categoryNameForm');
    const categoryNameInput = document.getElementById('categoryName');
    // Step 2: Image Upload
    const categoryImageForm = document.getElementById('categoryImageForm');
    const categoryImage = document.getElementById('categoryImage');
    const imagePreview = document.getElementById('imagePreview');
    const messageBox = document.getElementById('messageBox');

    // For displaying the final image and category name
    let imageUrlDisplay = document.getElementById('imageUrlDisplay');
    if (!imageUrlDisplay) {
        imageUrlDisplay = document.createElement('div');
        imageUrlDisplay.id = 'imageUrlDisplay';
        imageUrlDisplay.style.marginTop = '1rem';
        imageUrlDisplay.style.wordBreak = 'break-all';
        messageBox.parentNode.appendChild(imageUrlDisplay);
    }

    // Get branchId from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    let branchId = urlParams.get('branchId');
    let categoryId = '';
    let imageContentType = '';
    let presignedUploadUrl = '';
    let presignedKey = '';
    let presignedContentType = '';
    let originalImageFile = null;
    let previewDataUrl = '';
    let lastCategoryName = '';

    if (!branchId) {
        showMessage('Branch ID is required in the URL (?branchId=...)', 'error');
        categoryNameForm.style.display = 'none';
        categoryImageForm.style.display = 'none';
        return;
    }

    // Step 1: Handle category name submission
    categoryNameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoryName = categoryNameInput.value.trim();
        if (!categoryName) {
            showMessage('Please enter a category name.', 'error');
            return;
        }
        lastCategoryName = categoryName;
        try {
            // Create the category
            const response = await fetch(`/api/branch/${branchId}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branchId, name: categoryName })
            });
            if (!response.ok) {
                throw new Error('Failed to create category');
            }
            const data = await response.json();
            categoryId = data._id;

            // Immediately get the pre-signed URL for image upload (default to image/jpeg)
            imageContentType = 'image/jpeg';
            const urlRes = await fetch(`/api/branch/${branchId}/categories/${categoryId}/image-upload-url?contentType=${encodeURIComponent(imageContentType)}`);
            if (!urlRes.ok) {
                throw new Error('Failed to get pre-signed URL');
            }
            const { uploadUrl, key } = await urlRes.json();
            presignedUploadUrl = uploadUrl;
            presignedKey = key;
            presignedContentType = imageContentType;

            showMessage('Category created! Now upload an image.', 'success');
            // Hide step 1, show step 2
            categoryNameForm.style.display = 'none';
            categoryImageForm.style.display = 'flex';
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    // Step 2: Image preview and update presigned URL if needed
    categoryImage.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                showMessage('Image size should be less than 5MB', 'error');
                categoryImage.value = '';
                return;
            }
            originalImageFile = file;
            // Always use image/jpeg for upload
            imageContentType = 'image/jpeg';
            // Only fetch a new pre-signed URL if not already jpeg
            if (imageContentType !== presignedContentType && categoryId) {
                try {
                    const urlRes = await fetch(`/api/branch/${branchId}/categories/${categoryId}/image-upload-url?contentType=${encodeURIComponent(imageContentType)}`);
                    if (!urlRes.ok) {
                        throw new Error('Failed to get pre-signed URL for JPEG');
                    }
                    const { uploadUrl, key } = await urlRes.json();
                    presignedUploadUrl = uploadUrl;
                    presignedKey = key;
                    presignedContentType = imageContentType;
                } catch (error) {
                    showMessage(error.message, 'error');
                    return;
                }
            }
            // Preview the image
            const reader = new FileReader();
            reader.onload = (e) => {
                previewDataUrl = e.target.result;
                imagePreview.innerHTML = `<img src="${previewDataUrl}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Compress and convert image to JPEG with white background
    async function compressAndConvertToJpeg(file, quality = 0.7, maxDim = 1024) {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = function () {
                let width = img.width;
                let height = img.height;
                // Resize if needed
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                // Fill with white
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                // Draw the image
                ctx.drawImage(img, 0, 0, width, height);
                // Export as JPEG
                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Compression failed'));
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = function () {
                reject(new Error('Image load error'));
            };
            // Use FileReader to get data URL
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Step 2: Handle image upload
    categoryImageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!originalImageFile) {
            showMessage('Please select an image.', 'error');
            return;
        }
        if (!presignedUploadUrl || !presignedKey) {
            showMessage('Pre-signed URL not available. Please try again.', 'error');
            return;
        }
        try {
            // Compress and convert to JPEG with white background
            const compressedBlob = await compressAndConvertToJpeg(originalImageFile, 0.7, 1024);
            // Upload image to S3 using the stored presigned URL
            const uploadRes = await fetch(presignedUploadUrl, {
                method: 'PUT',
                body: compressedBlob,
                headers: { 'Content-Type': 'image/jpeg' }
            });
            if (!uploadRes.ok) {
                throw new Error('Failed to upload image');
            }
            // Now update the category image URL in the backend
            const updateUrlRes = await fetch(`/api/branch/categories/${categoryId}/image-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: presignedKey })
            });
            if (!updateUrlRes.ok) {
                throw new Error('Failed to update category image URL');
            }
            const updateData = await updateUrlRes.json();
            // Hide forms and preview
            categoryImageForm.style.display = 'none';
            imagePreview.innerHTML = '';
            messageBox.style.display = 'none';
            // Show uploaded image with checkmark and category name
            if (updateData.imageUrl) {
                imageUrlDisplay.innerHTML = `
                  <div class="uploaded-category-result">
                    <div class="uploaded-image-wrapper">
                      <img src="${updateData.imageUrl}" alt="Uploaded Category Image" class="uploaded-image" />
                      <span class="checkmark-icon">&#10004;</span>
                    </div>
                    <div class="uploaded-category-name">${lastCategoryName}</div>
                  </div>
                `;
            } else {
                imageUrlDisplay.innerHTML = '';
            }
            originalImageFile = null;
            previewDataUrl = '';
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    // Helper function to show messages
    function showMessage(message, type) {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.style.display = 'block';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 5000);
    }
}); 