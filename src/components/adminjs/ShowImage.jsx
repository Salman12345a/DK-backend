import React from "react";
import { Box, Label } from "@adminjs/design-system";

const ShowImage = (props) => {
  const { record, property } = props;
  const value = record.params[property.path];

  if (!value) {
    return <Box>No image uploaded</Box>;
  }

  return (
    <Box>
      <Label>{property.label}</Label>
      <Box mt="default">
        <img
          src={value}
          alt={property.label}
          style={{
            maxWidth: "100%",
            maxHeight: "250px",
            objectFit: "contain",
            borderRadius: "4px",
          }}
        />
      </Box>
    </Box>
  );
};

export default ShowImage;
