import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "restaurant-service",
  brokers: ["localhost:9094"],
});

const admin = kafka.admin();

const run = async () => {
  await admin.connect();
  await admin.createTopics({
    topics: [
      { topic: "order-service" },
      { topic: "stock-consumption-service" },
    ],
  });
};
