#!/usr/bin/env node
// Entry point MCP standalone. Agentes de IA configuram isso como comando
// stdio (claude mcp add, claude_desktop_config.json, etc).
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import {
  USER_DATA_DIR,
  USER_CONFIG_PATH,
  USER_ENV_PATH,
  DEFAULT_CONFIG_PATH,
  ENV_EXAMPLE_PATH,
} from "../gateway/paths.js";
import { startStdioServer } from "../gateway/mcpServer.js";

function bootstrapUserDir() {
  mkdirSync(USER_DATA_DIR, { recursive: true });
  if (!existsSync(USER_CONFIG_PATH)) copyFileSync(DEFAULT_CONFIG_PATH, USER_CONFIG_PATH);
  if (!existsSync(USER_ENV_PATH)) copyFileSync(ENV_EXAMPLE_PATH, USER_ENV_PATH);
}

bootstrapUserDir();
startStdioServer();
