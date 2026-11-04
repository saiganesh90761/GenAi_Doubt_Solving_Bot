import OpenAI from "openai";
import { config } from "./config";

let cachedClient: OpenAI | null = null;
let lastApiKey: string | undefined = undefined;

export function getOpenRouter(): OpenAI {
  const apiKey = config.openrouter.apiKey || process.env.OPENROUTER_API_KEY;
  if (!cachedClient || lastApiKey !== apiKey) {
    lastApiKey = apiKey;
    cachedClient = new OpenAI({
      baseURL: config.openrouter.baseURL,
      apiKey: apiKey || "dummy-key",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Engineering Doubt Solver",
      },
    });
  }
  return cachedClient;
}

export const openrouter = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getOpenRouter();
    const value = Reflect.get(client, prop);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
