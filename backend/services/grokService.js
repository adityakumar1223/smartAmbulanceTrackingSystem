const axios = require("axios");
const pdfParse = require("pdf-parse");

const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Analyzes a document using xAI Grok API, falling back to Groq API if xAI fails.
 * Automatically determines a title and description.
 * Supports PDF parsing and image-based vision analysis.
 * 
 * @param {Buffer} fileBuffer The raw uploaded file buffer.
 * @param {string} mimeType The file mimetype.
 * @returns {Promise<{title: string, description: string}>}
 */
const analyzeDocument = async (fileBuffer, mimeType) => {
  const apiKey = process.env.GROK_API_KEY; // xAI key
  const groqApiKey = process.env.GROQ_API_KEY; // Groq key

  let textContent = "";
  if (mimeType === "application/pdf") {
    try {
      const pdfData = await pdfParse(fileBuffer);
      textContent = pdfData.text.trim();
    } catch (pdfErr) {
      console.warn("PDF parsing failed:", pdfErr.message);
    }
  }

  // --- Step 1: Try xAI Grok ---
  if (apiKey && apiKey.startsWith("xai-")) {
    try {
      console.log("Attempting xAI Grok analysis...");
      let title = "";
      let description = "";

      if (mimeType === "application/pdf") {
        if (!textContent) {
          throw new Error("PDF content is empty, cannot run text analysis");
        }
        const limitedText = textContent.substring(0, 4000);
        const response = await axios.post(
          GROK_API_URL,
          {
            model: "grok-2-1212",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: "You are a medical records assistant. Analyze the medical record text provided and return a JSON object with a concise, professional 'title' (max 5 words) and a brief summary 'description' (max 20 words). Format: { \"title\": \"...\", \"description\": \"...\" }"
              },
              {
                role: "user",
                content: `Here is the text from the medical document:\n\n${limitedText}`
              }
            ],
            temperature: 0.2
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            }
          }
        );

        const aiResponseText = response.data.choices[0].message.content;
        const parsedData = JSON.parse(aiResponseText);
        title = parsedData.title;
        description = parsedData.description;

      } else if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
        const base64Image = fileBuffer.toString("base64");
        const response = await axios.post(
          GROK_API_URL,
          {
            model: "grok-2-vision-1212",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "You are a medical records assistant. Analyze the uploaded medical document image and return a JSON object with a concise, professional 'title' (max 5 words) and a brief summary 'description' (max 20 words). Format: { \"title\": \"...\", \"description\": \"...\" }"
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${base64Image}`
                    }
                  }
                ]
              }
            ],
            temperature: 0.2
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            }
          }
        );

        const aiResponseText = response.data.choices[0].message.content;
        const parsedData = JSON.parse(aiResponseText);
        title = parsedData.title;
        description = parsedData.description;
      }

      if (title || description) {
        console.log("xAI Grok analysis succeeded!");
        return {
          title: title || "Medical Document",
          description: description || "Successfully analyzed medical record."
        };
      }
    } catch (err) {
      console.warn("xAI Grok analysis failed, falling back to Groq:", err.message);
    }
  }

  // --- Step 2: Fallback to Groq ---
  if (groqApiKey) {
    try {
      console.log("Attempting Groq fallback analysis...");
      let title = "";
      let description = "";

      if (mimeType === "application/pdf") {
        if (!textContent) {
          throw new Error("PDF content is empty, cannot run text analysis");
        }
        const limitedText = textContent.substring(0, 4000);
        const response = await axios.post(
          GROQ_API_URL,
          {
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: "You are a medical records assistant. Analyze the medical record text provided and return a JSON object with a concise, professional 'title' (max 5 words) and a brief summary 'description' (max 20 words). Format: { \"title\": \"...\", \"description\": \"...\" }"
              },
              {
                role: "user",
                content: `Here is the text from the medical document:\n\n${limitedText}`
              }
            ],
            temperature: 0.2
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groqApiKey}`
            }
          }
        );

        const aiResponseText = response.data.choices[0].message.content;
        const parsedData = JSON.parse(aiResponseText);
        title = parsedData.title;
        description = parsedData.description;

      } else if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
        const base64Image = fileBuffer.toString("base64");
        const response = await axios.post(
          GROQ_API_URL,
          {
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "You are a medical records assistant. Analyze the uploaded medical document image and return a JSON object with a concise, professional 'title' (max 5 words) and a brief summary 'description' (max 20 words). Format: { \"title\": \"...\", \"description\": \"...\" }"
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${base64Image}`
                    }
                  }
                ]
              }
            ],
            temperature: 0.2
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groqApiKey}`
            }
          }
        );

        const aiResponseText = response.data.choices[0].message.content;
        const parsedData = JSON.parse(aiResponseText);
        title = parsedData.title;
        description = parsedData.description;
      }

      if (title || description) {
        console.log("Groq fallback analysis succeeded!");
        return {
          title: title || "Medical Document",
          description: description || "Successfully analyzed medical record."
        };
      }
    } catch (err) {
      console.error("Groq fallback analysis failed:", err.message);
    }
  }

  // --- Step 3: Default fallback ---
  return {
    title: "Medical Document",
    description: "Successfully uploaded medical record document."
  };
};

module.exports = {
  analyzeDocument
};
