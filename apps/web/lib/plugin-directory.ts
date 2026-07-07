import type { McpTransport } from './mcp-servers';

// Curated starter plugins. Each connects over MCP. `tokenless` entries are
// verified public servers that add in one tap; others prefill the add form and
// ask the user to paste a token. `url` empty => opens a blank custom form.
// URLs here were live-verified to return tools; never ship an unverified URL.
export type PluginTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  transport: McpTransport;
  url?: string;
  tokenless?: boolean;
  authLabel?: string;        // e.g. "GitHub token"
  authPlaceholder?: string;  // e.g. "Bearer ghp_…"
  docsUrl?: string;
};

export const PLUGIN_DIRECTORY: PluginTemplate[] = [
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    description: 'Ask questions about any public GitHub repo — its code, architecture, and docs.',
    category: 'Knowledge',
    transport: 'http',
    url: 'https://mcp.deepwiki.com/mcp',
    tokenless: true,
    docsUrl: 'https://docs.devin.ai/work-with-devin/deepwiki-mcp',
  },
  {
    id: 'gitmcp',
    name: 'GitMCP',
    description: 'Docs & code search assistant for popular open-source libraries.',
    category: 'Knowledge',
    transport: 'http',
    url: 'https://gitmcp.io/docs',
    tokenless: true,
    docsUrl: 'https://gitmcp.io',
  },
  {
    id: 'mslearn',
    name: 'Microsoft Learn',
    description: 'Search official Microsoft, Azure, and .NET documentation.',
    category: 'Knowledge',
    transport: 'http',
    url: 'https://learn.microsoft.com/api/mcp',
    tokenless: true,
    docsUrl: 'https://learn.microsoft.com/training/support/mcp',
  },
  {
    id: 'custom',
    name: 'Custom server',
    description: 'Connect any MCP server — paste its endpoint and an optional token.',
    category: 'Custom',
    transport: 'http',
    docsUrl: 'https://github.com/sylviangth/awesome-remote-mcp-servers',
  },
];

// Link users to a broader community list rather than pretending to be exhaustive.
export const PLUGIN_DIRECTORY_MORE_URL = 'https://github.com/sylviangth/awesome-remote-mcp-servers';
