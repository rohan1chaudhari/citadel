# AI Template

A chat-based app template that demonstrates AI API integration. This template provides a foundation for building apps that leverage LLM capabilities.

## Structure

```
ai/
├── README.md           # This file
├── app.yaml            # App manifest (with ai: true permission)
├── page.tsx            # Chat UI
├── ChatClient.tsx      # Interactive chat component
├── api/
│   └── chat/
│       └── route.ts    # AI chat API endpoint
└── migrations/
    └── 001_initial.sql # Chat history schema
```

## Features

- **Chat Interface**: Clean, familiar chat UI with message bubbles
- **AI Integration**: Backend route that calls AI APIs
- **History**: Persistent chat history stored in SQLite
- **Streaming**: Real-time streaming responses (placeholder)
- **System Prompts**: Configurable system context

## Prerequisites

The `ai: true` permission in `app.yaml` allows this app to call AI endpoints. The host must have an AI provider configured (OpenAI, Anthropic, etc.).

## Getting Started

1. Copy this directory to `apps/my-ai-app/`
2. Edit `app.yaml` - change `id` and `name`
3. Customize the system prompt in `api/chat/route.ts`
4. Restart the Citadel host
5. Visit `/apps/my-ai-app` to start chatting

## Customization Ideas

- **Specialized Assistant**: Change the system prompt for a specific use case (writing helper, code reviewer, etc.)
- **Structured Output**: Parse AI responses into structured data
- **Multi-turn Context**: Improve context window management
- **File Attachments**: Allow users to upload files for analysis
- **Model Selection**: Let users choose between different models

## Security Notes

- AI API calls go through the host's AI provider abstraction
- Rate limits apply per the host's configuration
- User inputs are logged via the audit system
