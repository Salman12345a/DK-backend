import React, { useState } from "react";
import {
  Box,
  Label,
  DropZone,
  Button,
  Icon,
  MessageBox,
} from "@adminjs/design-system";

const UploadImage = (props) => {
  const { property, onChange, record } = props;
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);

  // Get the current image URL if any
  const imageUrl = record?.params?.imageUrl;

  const onUpload = (files) => {
    setError(null);
    const [uploadedFile] = files;

    // Validate file type
    const acceptedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!acceptedTypes.includes(uploadedFile.type)) {
      setError("Invalid file type. Only JPEG, JPG, and PNG are accepted.");
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (uploadedFile.size > maxSize) {
      setError("File too large. Maximum size is 5MB.");
      return;
    }

    setFile(uploadedFile);
    onChange(property.path, uploadedFile);
  };

  return (
    <Box marginBottom="xl">
      <Label>{property.label}</Label>

      {error && <MessageBox message={error} variant="danger" mb="lg" />}

      <DropZone onChange={onUpload} />

      {file && (
        <Box my="lg">
          <Label>Selected file: {file.name}</Label>
        </Box>
      )}

      {imageUrl && !file && (
        <Box mt="default">
          <Label>Current image:</Label>
          <img
            src={imageUrl}
            alt={property.label}
            style={{
              maxWidth: "100%",
              maxHeight: "150px",
              objectFit: "contain",
              borderRadius: "4px",
              marginTop: "8px",
            }}
          />
        </Box>
      )}

      <Box mt="default">
        <Label>
          <Icon icon="Info" />
          <Box ml="default" as="span">
            Upload an image file (JPEG, PNG). Max size: 5MB.
          </Box>
        </Label>
      </Box>
    </Box>
  );
};

export default UploadImage;
