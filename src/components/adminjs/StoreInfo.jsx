import React, { useState, useEffect } from "react";
import { Box, H3, Text, Button, Loader } from "@adminjs/design-system";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const StoreInfo = (props) => {
  const { record: { params } = {} } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storeData, setStoreData] = useState(null);

  const storeId = params.id;

  const fetchStoreInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.resourceAction({
        resourceId: "Store",
        actionName: "getStoreInfo",
        params: { storeId },
      });

      if (response.data) {
        setStoreData(response.data);
      } else {
        setError("No data returned from the server");
      }
    } catch (err) {
      setError(err.message || "Failed to fetch store information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchStoreInfo();
    }
  }, [storeId]);

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
        <Button onClick={fetchStoreInfo} mt="default">
          Retry
        </Button>
      </Box>
    );
  }

  if (!storeData) {
    return (
      <Box>
        <Text>No information available for this store</Text>
      </Box>
    );
  }

  return (
    <Box>
      <H3>Store Information</H3>
      <Box
        p="lg"
        mb="xl"
        style={{ border: "1px solid #eee", borderRadius: "10px" }}
      >
        <Text mb="lg">
          <strong>Name:</strong> {storeData.name}
        </Text>
        <Text mb="lg">
          <strong>Owner:</strong> {storeData.owner}
        </Text>
        <Text mb="lg">
          <strong>Email:</strong> {storeData.email}
        </Text>
        <Text mb="lg">
          <strong>Phone:</strong> {storeData.phone}
        </Text>
        <Text mb="lg">
          <strong>Address:</strong> {storeData.address}
        </Text>
        <Text mb="lg">
          <strong>Created:</strong>{" "}
          {new Date(storeData.createdAt).toLocaleString()}
        </Text>
        <Text mb="lg">
          <strong>Status:</strong> {storeData.status}
        </Text>
      </Box>
    </Box>
  );
};

export default StoreInfo;
