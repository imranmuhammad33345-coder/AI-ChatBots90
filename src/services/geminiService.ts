import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function solveMathProblem(text: string, imageBase64?: string, mimeType?: string, subject: string = 'Math') {
  try {
    const parts: any[] = [];
    
    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      });
    }
    
    if (text) {
      parts.push({ text });
    } else {
      parts.push({ text: `Please solve the ${subject.toLowerCase()} problem in this image step by step. Format the math expressions using LaTeX syntax enclosed in $ for inline math and $$ for block math.` });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: `You are an expert ${subject} tutor. Solve the ${subject.toLowerCase()} problem provided by the user step by step. Explain the concepts clearly. Use LaTeX formatting for all mathematical expressions, equations, and variables. Enclose inline math in single dollar signs ($math$) and block math in double dollar signs ($$math$$).`,
      }
    });

    return response.text;
  } catch (error: any) {
    console.error("Error solving math problem:", error);
    
    let errorMessage = "An unexpected error occurred while solving the problem.";
    let parsedError = error;

    // Attempt to parse JSON error message from Gemini API
    if (error.message && typeof error.message === 'string') {
      try {
        const match = error.message.match(/({.*})/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (parsed.error) {
            parsedError = parsed.error;
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    const status = parsedError?.status || error?.status;
    const code = parsedError?.code || error?.code;

    if (status === 'NOT_FOUND' || code === 404) {
      errorMessage = "The requested AI model was not found. Please try again later.";
    } else if (status === 'RESOURCE_EXHAUSTED' || code === 429) {
      errorMessage = "You've reached the rate limit. Please wait a moment and try again.";
    } else if (status === 'INVALID_ARGUMENT' || code === 400) {
      errorMessage = "The provided image or text is invalid. Please check your input and try again.";
    } else if (status === 'UNAUTHENTICATED' || code === 401) {
      errorMessage = "Authentication failed. Please check the API key configuration.";
    } else if (status === 'PERMISSION_DENIED' || code === 403) {
      errorMessage = "Permission denied. The API key may not have access to this model.";
    } else if (status === 'INTERNAL' || code === 500) {
      errorMessage = "The AI service experienced an internal error. Please try again later.";
    } else if (status === 'UNAVAILABLE' || code === 503) {
      errorMessage = "The AI service is currently unavailable. Please try again later.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
}
