import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

export const suggestions = [
  "How can I design a veranda project in 3D with Cover 3D?",
  "What are the advantages of using Cover 3D for outdoor joinery projects?",
  "Explain how to create pergolas and extensions using Cover 3D software",
  "How does Cover 3D help with quotation and fabrication automation?",
];
