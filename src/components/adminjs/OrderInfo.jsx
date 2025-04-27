import React from "react";
import { Box, H3, Text } from "@adminjs/design-system";

const OrderInfo = (props) => {
  const { record } = props;

  if (!record) {
    return (
      <Box>
        <Text>No order information available</Text>
      </Box>
    );
  }

  return (
    <Box>
      <H3>Order #{record.params.id}</H3>
      <Text>
        This is a simplified order view for testing component loading.
      </Text>
      <Box mt="xl">
        <pre>{JSON.stringify(record.params, null, 2)}</pre>
      </Box>
    </Box>
  );
};

export default OrderInfo;
