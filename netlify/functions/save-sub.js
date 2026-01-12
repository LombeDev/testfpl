import { getStore } from "@netlify/blobs";

export const handler = async (event) => {
  const { fplId, subscription } = JSON.parse(event.body);
  
  // Create a store named 'fpl-managers'
  const store = getStore("fpl-managers");
  
  // Save the subscription using the FPL ID as the key
  await store.setJSON(fplId.toString(), subscription);

  return { statusCode: 200, body: "Subscribed!" };
};
