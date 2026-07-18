---
title: "Sitecrawl MCP Upgrades: Launch Week III - Day 6"
description: "Major updates to the Sitecrawl MCP server, now with FIRE-1 support and Server-Sent Events for faster, easier web data access."
pubDate: "Apr 19, 2025"
heroImage: "../../assets/blog/lw3-d6-2.webp"
category: "updates"
---

**Welcome to Launch Week III, Day 6 — Sitecrawl MCP Upgrades.**

Today, we’re rolling out a major set of updates to our Sitecrawl MCP server — our implementation of the Model Context Protocol (MCP) that powers scraping workflows with LLMs and web data.

## FIRE-1 Web Action Agent Support

The Sitecrawl MCP server now supports our new **FIRE-1** model. This means you can now:

- Use FIRE-1 via the MCP scrape and extract endpoints.
- Seamlessly collect data behind interaction barriers — logins, buttons, modals, and more.
- Incorporate intelligent, agent-driven scraping into any MCP-compatible tool.

## Server-Sent Events (SSE)

We’ve added **HTTP Server-Side Events (SSE)** support to the MCP, making real-time communication and data flow smoother.

- SSE is now available for local use.
- This means you can plug into a running Sitecrawl MCP server with minimal overhead.

## Learn More

Check out our updated docs and MCP repo:

- [Sitecrawl MCP](https://github.com/sitecrawl/sitecrawl-mcp-server)
- [FIRE-1 Agent Info](https://docs.sitecrawl.dev/agents/fire-1)
