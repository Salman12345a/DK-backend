document.addEventListener('DOMContentLoaded', () => {
    // Step 1: Category Name
    const categoryNameForm = document.getElementById('categoryNameForm');
    const categoryNameInput = document.getElementById('categoryName');
    // Step 2: Image Upload
    const categoryImageForm = document.getElementById('categoryImageForm');
    const categoryImage = document.getElementById('categoryImage');
    const imagePreview = document.getElementById('imagePreview');
    const messageBox = document.getElementById('messageBox');

    // For displaying the final image URL
    let imageUrlDisplay = document.getElementById('imageUrlDisplay');
    if (!imageUrlDisplay) {
        imageUrlDisplay = document.createElement('div');
        imageUrlDisplay.id = 'imageUrlDisplay';
        imageUrlDisplay.style.marginTop = '1rem';
        imageUrlDisplay.style.wordBreak = 'break-all';
        messageBox.parentNode.appendChild(imageUrlDisplay);
    }

    // Store branchId, categoryId, and presigned URL info for the session
    let branchId = '';
    let categoryId = '';
    let imageContentType = '';
    let presignedUploadUrl = '';
    let presignedKey = '';
    let presignedContentType = '';

    // Prompt for branchId (or set it here for demo)
    branchId = prompt('Enter your Branch ID:');
    if (!branchId) {
        showMessage('Branch ID is required!', 'error');
        categoryNameForm.style.display = 'none';
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
            imageContentType = file.type;
            // Only fetch a new pre-signed URL if the type is different from the last one used
            if (imageContentType !== presignedContentType && categoryId) {
                try {
                    const urlRes = await fetch(`/api/branch/${branchId}/categories/${categoryId}/image-upload-url?contentType=${encodeURIComponent(imageContentType)}`);
                    if (!urlRes.ok) {
                        throw new Error('Failed to get pre-signed URL for selected image type');
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
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Step 2: Handle image upload
    categoryImageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = categoryImage.files[0];
        if (!file) {
            showMessage('Please select an image.', 'error');
            return;
        }
        if (!presignedUploadUrl || !presignedKey) {
            showMessage('Pre-signed URL not available. Please try again.', 'error');
            return;
        }
        try {
            // Upload image to S3 using the stored presigned URL
            const uploadRes = await fetch(presignedUploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type }
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
            showMessage('Image uploaded and category updated successfully!', 'success');
            categoryImageForm.reset();
            imagePreview.innerHTML = '';
            if (updateData.imageUrl) {
                imageUrlDisplay.innerHTML = `<strong>Image URL:</strong> <a href="${updateData.imageUrl}" target="_blank">${updateData.imageUrl}</a>`;
            } else {
                imageUrlDisplay.innerHTML = '';
            }
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