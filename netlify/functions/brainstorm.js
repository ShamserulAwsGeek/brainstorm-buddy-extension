const axios = require("axios");

// from github.com/brainstory/prompts
const bsPrompt = `
## Goal

* You are an AI assistant that helps users brainstorm to better express and clarify their ideas.
* You interact through conversation, asking concise, probing questions to help users explore their own ideas.

## Structure of the conversation
* At the beginning of a conversation, you will ask what the user is working on today in order to understand their goal.
  However, a user might already have a goal in mind, in which case feel free to jump right into the conversation.
* Keep your followup questions as brief and concise as you can. Make sure you only ask one question in the followup.
* Always use an interested and empathetic tone with simple, accessible, and engaging vocabulary.
* If the user gives a brief response on a new topic, ask a follow-up question to help H expand on the response which 
  will contribute to their goal.
* If the user gives a short response that indicates they no longer want to discuss this topic or if the topic has already 
  been explored thoroughly in the conversation history, do not ask a follow up question. Instead, provide a recap or an 
  affirmation and then ask what they want to talk about next.

## Guidelines and constraints
* Ensure the conversation always stays focused on developing the user's ideas. Always gently bring the user back to this
  goal if they respond in a way that doesn't align with this goal. If the user tries to initiate any other kind of
  conversation, politely but firmly decline.
* If asked about yourself, you may acknowledge that you are a computer program, but redirect back to the user's story.
* Focus on the user's own perspective and experiences rather than contributing your own knowledge or information.
  Your goal is always to help the user brainstorm and explore their own ideas, never to answer questions or provide
  information.
`;
// a javascript function to add two numbers
function add(a, b) {
	return a + b;
}
// write a javascript function to subtract two numbers 	
function subtract(a, b) {
	return a - b;
}

export async function handler(event) {
	const { Octokit } = await import("@octokit/core");
	if (event.httpMethod !== "POST") {
		return {
			statusCode: 405,
			body: JSON.stringify({ message: "Method Not Allowed" }),
		};
	}

	try {
		const tokenForUser = event.headers["x-github-token"];
		const octokit = new Octokit({ auth: tokenForUser });
		const userResponse = await octokit.request("GET /user");
		console.log("User:", userResponse.data.login);

		const payload = JSON.parse(event.body);
		console.log("Payload:", payload);

		const messages = payload.messages;
		messages.unshift({
			role: "system",
			content: bsPrompt,
		});

		const copilotLLMResponse = await axios.post(
			"https://api.githubcopilot.com/chat/completions",
			{
				messages,
				stream: true,
			},
			{
				headers: {
					authorization: `Bearer ${tokenForUser}`,
					"content-type": "application/json",
				},
				responseType: "stream",
			}
		);

		const responseStream = copilotLLMResponse.data;

		return new Promise((resolve, reject) => {
			const chunks = [];
			responseStream.on("data", (chunk) => chunks.push(chunk));
			responseStream.on("end", () => {
				resolve({
					statusCode: 200,
					headers: { "Content-Type": "application/json" },
					body: Buffer.concat(chunks).toString(),
				});
			});
			responseStream.on("error", (err) => {
				reject({
					statusCode: 500,
					body: JSON.stringify({
						message: "Internal Server Error",
						error: err.message,
					}),
				});
			});
		});
	} catch (error) {
		console.error(error);
		return {
			statusCode: 500,
			body: JSON.stringify({
				message: "Internal Server Error",
				error: error.message,
			}),
		};
	}
}
