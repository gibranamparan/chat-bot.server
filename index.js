require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { handleToolCall, descriptions } = require('./sentrics-api');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const systemPrompt = `
You are a ChatBot administrator assistant in a elders community. You are ready to help the administrator with their questions.
Be brief and to the point. The user is already aware you are here to serve them so don't be too verbose.

Here are some instructions how to handle specific special cases:
- Every time you answer making reference to a record that already exists in the database for example a resident or a location, we are going to use HTML anchor elements, 
which means that you will put the name of the entity inside an anchor element <a> and the URL will be the full URL of the record in the database.
  For example:
    <a href="/residents/8f67842a-7319-4df6-bbae-d27ac6f14ec3">John Smith</a> will be a link to the resident record in the database.
    <a href="/places/8d77411d-e0f8-4d5f-a9c9-a48177c13b1f">Apt 119</a> will be a link to the location record in the database.
- If the user ask you to show the picture of a resident, if the user have a URL in its pictureUrl field, you can show the picture by using a html img tag with the src attribute set to the URL.
  For example:
    <img src="/api/picture/resident/64ad81ca7a772409bc06d147" alt="John Smith" width="100" />
`;

// Initialize conversation history with a developer message - preserved across requests
let messageHistory = [
    { role: "developer", content: systemPrompt }
];

// https://platform.openai.com/docs/guides/function-calling
const tools = descriptions;

async function callChatCompletion(messageHistory) {
    return await openai.chat.completions.create({
        messages: messageHistory,
        model: "gpt-4o",
        tools
    });
}

async function generateResponse(prompt) {
    try {
        // Add user's new message to history
        messageHistory.push({ role: "user", content: prompt });

        // https://platform.openai.com/docs/api-reference/chat/create
        let completion = await callChatCompletion(messageHistory);

        // Add assistant's response to history
        let message = completion.choices[0].message;
        messageHistory.push(message);

        while (message.tool_calls?.length > 0) {
            for (const toolCall of message.tool_calls) {
                // Handle each tool call
                const toolResult = await handleToolCall(toolCall);
                messageHistory.push(toolResult);
            }

            // After handling all tool calls, get a new completion
            completion = await callChatCompletion(messageHistory);
            message = completion.choices[0].message;
            messageHistory.push(message);
        }

        return message.content;
    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}

// API Routes
app.post('/chat', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({
                error: 'Prompt is required',
                example: { prompt: 'Who are all the residents?' }
            });
        }

        const response = await generateResponse(prompt);

        res.json({
            response: response,
            prompt: prompt
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Reset conversation history endpoint
app.post('/reset', (req, res) => {
    console.log('Resetting conversation history');
    messageHistory = [
        {
            role: "developer", content: systemPrompt
        }
    ];
    res.json({
        message: 'Conversation history has been reset',
        timestamp: new Date().toISOString()
    });
});

// Get conversation history endpoint (for debugging/monitoring)
app.get('/history', (req, res) => {
    res.json({
        messageCount: messageHistory.length,
        messages: messageHistory.map((msg, index) => ({
            index,
            role: msg.role,
            content: msg.content ? msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '') : 'N/A',
            hasToolCalls: !!msg.tool_calls
        }))
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
    console.log(`Chatbot server running on port ${port}`);
    console.log(`\nAvailable endpoints:`);
    console.log(`  POST http://localhost:${port}/chat - Send chat messages`);
    console.log(`  POST http://localhost:${port}/reset - Reset conversation history`);
    console.log(`  GET  http://localhost:${port}/history - View conversation history`);
    console.log(`  GET  http://localhost:${port}/health - Health check`);
    console.log(`\nExample chat request: { "prompt": "Who are all the residents?" }`);
}); 