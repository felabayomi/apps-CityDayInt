import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "default_key" 
});

export interface CityContentData {
  morning: {
    title: string;
    description: string;
    imagePrompt: string;
  };
  afternoon: {
    title: string;
    description: string;
    imagePrompt: string;
  };
  evening: {
    title: string;
    description: string;
    imagePrompt: string;
  };
  funFact: string;
  flag: string;
}

export async function generateCityContent(cityName: string): Promise<CityContentData> {
  try {
    const prompt = `Generate comprehensive travel content for ${cityName}. 

Please provide:
1. Morning discovery content: A landmark or cultural site to visit
2. Afternoon content: Local food or cultural experience  
3. Evening content: A practical budget tip or local insight
4. A fascinating fun fact about the city
5. The country flag emoji for the city

Format the response as JSON with this exact structure:
{
  "morning": {
    "title": "Short engaging title (e.g., 'Visit Historic Cathedral')",
    "description": "2-3 sentence description of what to do and why it's special",
    "imagePrompt": "Detailed prompt for generating an image of this landmark/activity"
  },
  "afternoon": {
    "title": "Local food or cultural experience title",
    "description": "2-3 sentence description of the food/experience",
    "imagePrompt": "Detailed prompt for generating an image of this food/cultural element"
  },
  "evening": {
    "title": "Budget tip or practical advice title",
    "description": "2-3 sentence practical travel tip to save money or enhance the experience",
    "imagePrompt": "Detailed prompt for generating an image related to this tip (transport, markets, etc.)"
  },
  "funFact": "An interesting and surprising fact about the city that most people don't know",
  "flag": "Country flag emoji for ${cityName}"
}

Ensure all content is authentic, practical, and engaging. Focus on experiences that give travelers genuine cultural insights.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
      messages: [
        {
          role: "system",
          content: "You are a knowledgeable travel expert who creates engaging, authentic content about cities around the world. Always respond with valid JSON formatted exactly as requested."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content generated from OpenAI");
    }

    const parsedContent = JSON.parse(content) as CityContentData;
    
    // Validate the structure
    if (!parsedContent.morning || !parsedContent.afternoon || !parsedContent.evening) {
      throw new Error("Invalid content structure from OpenAI");
    }

    return parsedContent;
  } catch (error) {
    console.error("Error generating city content:", error);
    throw new Error(`Failed to generate content for ${cityName}: ${error.message}`);
  }
}

export async function generateImageUrl(imagePrompt: string): Promise<string> {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    return response.data[0].url || '';
  } catch (error) {
    console.error("Error generating image:", error);
    // Return a fallback Unsplash URL based on the prompt keywords
    const keywords = imagePrompt.split(' ').slice(0, 3).join(',');
    return `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`;
  }
}

export async function analyzeCityImage(base64Image: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this city image and describe what you see. Focus on architectural features, cultural elements, and any identifying landmarks that would help travelers understand the location."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      max_tokens: 300,
    });

    return response.choices[0].message.content || "Unable to analyze image";
  } catch (error) {
    console.error("Error analyzing image:", error);
    return "Image analysis not available";
  }
}
