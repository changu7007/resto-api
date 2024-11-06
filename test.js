import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: 100,
  duration: "30s",
  cloud: {
    // Project: HANUMAN_API
    projectID: 3718652,
    // Test runs with the same name groups test runs together.
    name: "Test 1",
  },
};

export default function () {
  http.get("https://api.divinecoorgcoffee.com/api/v1/product/get-product");
  sleep(1);
}
