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
  Icon,
} from "@adminjs/design-system";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const ProductInfo = (props) => {
  const { record: { params } = {} } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productData, setProductData] = useState(null);

  const productId = params.id;

  const fetchProductInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.resourceAction({
        resourceId: "Product",
        actionName: "getProductDetails",
        params: { productId },
      });

      if (response.data) {
        setProductData(response.data);
      } else {
        setError("No data returned from the server");
      }
    } catch (err) {
      setError(err.message || "Failed to fetch product information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchProductInfo();
    }
  }, [productId]);

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
        <Button onClick={fetchProductInfo} mt="default">
          Retry
        </Button>
      </Box>
    );
  }

  if (!productData) {
    return (
      <Box>
        <Text>No information available for this product</Text>
      </Box>
    );
  }

  const getStockStatusVariant = (status) => {
    if (status === "In Stock") return "success";
    if (status === "Low Stock") return "warning";
    if (status === "Out of Stock") return "danger";
    return "light";
  };

  return (
    <Box>
      {/* Product Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        mb="xl"
      >
        <Box>
          <H3>{productData.name}</H3>
          <Text size="lg" mt="sm" color="grey">
            SKU: {productData.sku}
          </Text>
        </Box>
        <Box display="flex" alignItems="center">
          <Badge
            size="lg"
            variant={productData.isActive ? "success" : "danger"}
            mr="default"
          >
            {productData.isActive ? "Active" : "Inactive"}
          </Badge>
          <Badge
            size="lg"
            variant={getStockStatusVariant(productData.stockStatus)}
          >
            {productData.stockStatus}
          </Badge>
        </Box>
      </Box>

      {/* Product Images */}
      {productData.images && productData.images.length > 0 && (
        <Box
          p="lg"
          mb="xl"
          style={{ border: "1px solid #eee", borderRadius: "10px" }}
        >
          <H3 mb="lg">Product Images</H3>
          <Box display="flex" flexWrap="wrap">
            {productData.images.map((image, index) => (
              <Box
                key={index}
                mr="lg"
                mb="lg"
                style={{
                  width: "150px",
                  height: "150px",
                  border: image.isMain ? "2px solid #0070f3" : "1px solid #eee",
                  borderRadius: "5px",
                  padding: "3px",
                  position: "relative",
                }}
              >
                <img
                  src={image.url}
                  alt={`Product image ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "3px",
                  }}
                />
                {image.isMain && (
                  <Badge
                    variant="primary"
                    size="sm"
                    style={{
                      position: "absolute",
                      top: "5px",
                      left: "5px",
                    }}
                  >
                    Main
                  </Badge>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Product Details */}
      <Box
        p="lg"
        mb="xl"
        style={{ border: "1px solid #eee", borderRadius: "10px" }}
      >
        <H3 mb="lg">Product Details</H3>
        <Box
          display="flex"
          flexDirection={["column", "column", "row"]}
          flexWrap="wrap"
        >
          <Box width={[1, 1, 1 / 2]} pr={[0, 0, "lg"]} mb="lg">
            <Text fontWeight="bold" mb="sm">
              Description
            </Text>
            <Text mb="xl">
              {productData.description || "No description provided"}
            </Text>

            <Text fontWeight="bold" mb="sm">
              Category
            </Text>
            <Text mb="lg">{productData.category?.name || "Uncategorized"}</Text>

            {productData.brand && (
              <>
                <Text fontWeight="bold" mb="sm">
                  Brand
                </Text>
                <Text mb="lg">{productData.brand}</Text>
              </>
            )}
          </Box>

          <Box width={[1, 1, 1 / 2]}>
            <Text fontWeight="bold" mb="sm">
              Price
            </Text>
            <Box display="flex" alignItems="center" mb="lg">
              <Text fontWeight="bold" size="xl">
                ${productData.price?.toFixed(2)}
              </Text>
              {productData.compareAtPrice && (
                <Text
                  ml="default"
                  style={{
                    textDecoration: "line-through",
                    color: "#999",
                  }}
                >
                  ${productData.compareAtPrice.toFixed(2)}
                </Text>
              )}
            </Box>

            <Text fontWeight="bold" mb="sm">
              Inventory
            </Text>
            <Text mb="lg">
              {productData.inventoryManagement ? (
                <>
                  <Text>Quantity: {productData.quantity || 0}</Text>
                  {productData.inventoryPolicy && (
                    <Text mt="sm">Policy: {productData.inventoryPolicy}</Text>
                  )}
                </>
              ) : (
                "Inventory not tracked"
              )}
            </Text>

            <Text fontWeight="bold" mb="sm">
              Last Updated
            </Text>
            <Text mb="lg">
              {new Date(productData.updatedAt).toLocaleString()}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Variants */}
      {productData.variants && productData.variants.length > 0 && (
        <Box
          p="lg"
          mb="xl"
          style={{ border: "1px solid #eee", borderRadius: "10px" }}
        >
          <H3 mb="lg">Product Variants</H3>
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Cell>Variant</Table.Cell>
                <Table.Cell>SKU</Table.Cell>
                <Table.Cell>Price</Table.Cell>
                <Table.Cell>Stock</Table.Cell>
                <Table.Cell>Status</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {productData.variants.map((variant, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    {variant.title ||
                      variant.options?.map((opt) => opt.value).join(" / ")}
                  </Table.Cell>
                  <Table.Cell>{variant.sku}</Table.Cell>
                  <Table.Cell>${variant.price?.toFixed(2)}</Table.Cell>
                  <Table.Cell>{variant.quantity}</Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="sm"
                      variant={variant.isActive ? "success" : "danger"}
                    >
                      {variant.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Box>
      )}

      {/* Additional Details */}
      {(productData.weight ||
        productData.dimensions ||
        productData.attributes) && (
        <Box
          p="lg"
          mb="xl"
          style={{ border: "1px solid #eee", borderRadius: "10px" }}
        >
          <H3 mb="lg">Additional Details</H3>

          <Box
            display="flex"
            flexDirection={["column", "column", "row"]}
            flexWrap="wrap"
          >
            {/* Weight & Dimensions */}
            {(productData.weight || productData.dimensions) && (
              <Box width={[1, 1, 1 / 2]} pr={[0, 0, "lg"]} mb="lg">
                {productData.weight && (
                  <Box mb="lg">
                    <Text fontWeight="bold" mb="sm">
                      Weight
                    </Text>
                    <Text>
                      {productData.weight} {productData.weightUnit || "kg"}
                    </Text>
                  </Box>
                )}

                {productData.dimensions && (
                  <Box>
                    <Text fontWeight="bold" mb="sm">
                      Dimensions
                    </Text>
                    <Text>
                      {productData.dimensions.length} ×{" "}
                      {productData.dimensions.width} ×{" "}
                      {productData.dimensions.height}{" "}
                      {productData.dimensionsUnit || "cm"}
                    </Text>
                  </Box>
                )}
              </Box>
            )}

            {/* Attributes */}
            {productData.attributes && productData.attributes.length > 0 && (
              <Box width={[1, 1, 1 / 2]}>
                <Text fontWeight="bold" mb="sm">
                  Attributes
                </Text>
                {productData.attributes.map((attr, index) => (
                  <Box key={index} display="flex" mb="sm">
                    <Text fontWeight="bold" mr="default">
                      {attr.name}:
                    </Text>
                    <Text>{attr.value}</Text>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* SEO Information */}
      {productData.seo && (
        <Box
          p="lg"
          mb="xl"
          style={{ border: "1px solid #eee", borderRadius: "10px" }}
        >
          <H3 mb="lg">SEO Information</H3>

          <Box mb="lg">
            <Text fontWeight="bold" mb="sm">
              SEO Title
            </Text>
            <Text mb="lg">{productData.seo.title || "Not set"}</Text>
          </Box>

          <Box mb="lg">
            <Text fontWeight="bold" mb="sm">
              Meta Description
            </Text>
            <Text mb="lg">{productData.seo.description || "Not set"}</Text>
          </Box>

          {productData.seo.keywords && (
            <Box>
              <Text fontWeight="bold" mb="sm">
                Keywords
              </Text>
              <Box display="flex" flexWrap="wrap">
                {productData.seo.keywords.split(",").map((keyword, index) => (
                  <Badge key={index} mr="default" mb="default" variant="light">
                    {keyword.trim()}
                  </Badge>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Sales Performance */}
      {productData.salesStats && (
        <Box
          p="lg"
          mb="xl"
          style={{ border: "1px solid #eee", borderRadius: "10px" }}
        >
          <H3 mb="lg">Sales Performance</H3>

          <Box
            display="flex"
            flexDirection={["column", "column", "row"]}
            flexWrap="wrap"
          >
            <Box width={[1, 1, 1 / 4]} mb="lg" pr={[0, 0, "lg"]}>
              <Text color="grey" mb="sm">
                Total Sales
              </Text>
              <Text fontWeight="bold" size="xl">
                {productData.salesStats.totalSales || 0}
              </Text>
            </Box>

            <Box width={[1, 1, 1 / 4]} mb="lg" pr={[0, 0, "lg"]}>
              <Text color="grey" mb="sm">
                Revenue
              </Text>
              <Text fontWeight="bold" size="xl">
                ${productData.salesStats.revenue?.toFixed(2) || "0.00"}
              </Text>
            </Box>

            <Box width={[1, 1, 1 / 4]} mb="lg" pr={[0, 0, "lg"]}>
              <Text color="grey" mb="sm">
                Last 30 Days
              </Text>
              <Text fontWeight="bold" size="xl">
                {productData.salesStats.last30Days || 0}
              </Text>
            </Box>

            <Box width={[1, 1, 1 / 4]} mb="lg">
              <Text color="grey" mb="sm">
                Returns
              </Text>
              <Text fontWeight="bold" size="xl">
                {productData.salesStats.returns || 0}
              </Text>
            </Box>
          </Box>

          {productData.salesStats.lastSold && (
            <Box mt="lg">
              <Text fontWeight="bold">
                Last Sold:{" "}
                {new Date(productData.salesStats.lastSold).toLocaleString()}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Related Products */}
      {productData.relatedProducts &&
        productData.relatedProducts.length > 0 && (
          <Box
            p="lg"
            mb="xl"
            style={{ border: "1px solid #eee", borderRadius: "10px" }}
          >
            <H3 mb="lg">Related Products</H3>

            <Box display="flex" flexWrap="wrap">
              {productData.relatedProducts.map((product, index) => (
                <Box
                  key={index}
                  width={[1, 1 / 2, 1 / 3]}
                  p="md"
                  mb="md"
                  mr={["0", "md", "md"]}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: "5px",
                  }}
                >
                  <Box display="flex" alignItems="center" mb="sm">
                    {product.image && (
                      <Box
                        mr="default"
                        style={{ width: "40px", height: "40px" }}
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: "3px",
                          }}
                        />
                      </Box>
                    )}
                    <Text fontWeight="bold">{product.name}</Text>
                  </Box>

                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Text>${product.price?.toFixed(2)}</Text>
                    <Button
                      as="a"
                      href={`/admin/resources/Product/records/${product.id}/show`}
                      size="sm"
                      variant="text"
                    >
                      View
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
    </Box>
  );
};

export default ProductInfo;
