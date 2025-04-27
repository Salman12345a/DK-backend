import React, { useState, useEffect } from "react";
import { Label, Box, DropZone, Button } from "@adminjs/design-system";

const FileUploadComponent = (props) => {
  const { property, onChange, record } = props;
  const [file, setFile] = useState(null);

  // Get current file URL if it exists
  const imageUrl = record?.params?.imageUrl || null;

  // Handle file upload
  const onUpload = (files) => {
    const uploadedFile = files[0];
    setFile(uploadedFile);
    onChange(property.name, uploadedFile);
  };

  return (
    <Box marginBottom="xl">
      <Label>{property.label}</Label>
      <DropZone onChange={onUpload} />

      {file && (
        <Box mt="default">
          <Label>Selected file: {file.name}</Label>
        </Box>
      )}

      {imageUrl && !file && (
        <Box mt="default">
          <Label>Current Image:</Label>
          <Box mt="default">
            <img
              src={imageUrl}
              alt="Current"
              style={{ maxWidth: "100%", maxHeight: "150px" }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default FileUploadComponent;
