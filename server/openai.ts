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
    const prompt = `Generate engaging travel content for ${cityName} as today's Daily Felix – City of the Day International feature.

This city must be treated as a world-famous, popular international tourist destination. Focus on experiences that are iconic, widely beloved, and genuinely useful for international visitors.

Please provide:
1. Morning discovery: The city's most iconic landmark or must-see cultural site — describe what makes it unmissable for international tourists
2. Afternoon experience: The best local food scene or cultural experience that defines the city's international identity
3. Evening insight: A practical budget tip or insider travel hack that international visitors will find valuable
4. A surprising fun fact most international tourists don't know
5. The country flag emoji

Format the response as JSON with this exact structure:
{
  "morning": {
    "title": "Short, punchy title (e.g., 'The Eiffel Tower at Sunrise')",
    "description": "2-3 sentences describing why this is a must-see for international tourists, what to expect, and a practical tip",
    "imagePrompt": "Detailed visual prompt for an iconic photo of this landmark/attraction"
  },
  "afternoon": {
    "title": "Local food or cultural experience title",
    "description": "2-3 sentences on the must-try dish, market, or cultural activity that defines the city internationally",
    "imagePrompt": "Detailed visual prompt for vibrant food or cultural scene imagery"
  },
  "evening": {
    "title": "Smart travel tip or budget insight",
    "description": "2-3 sentences of practical advice: best time to visit, how to save money, what to avoid as a tourist, or a local secret",
    "imagePrompt": "Visual prompt for a city scene at golden hour or evening that reflects the tip"
  },
  "funFact": "A surprising, specific, and memorable fact about ${cityName} that even frequent travelers often don't know",
  "flag": "Country flag emoji for ${cityName}"
}

Ensure the tone is enthusiastic yet informative — the kind of content that makes someone want to book a flight immediately.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
      messages: [
        {
          role: "system",
          content: "You are a world-class travel editor for Daily Felix – City of the Day International, a platform that features one iconic international tourist destination every day. You write content that is vivid, accurate, and inspires people to explore the world's most popular destinations. Always respond with valid JSON formatted exactly as requested."
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
              text: "Analyze this city image and describe what you see. Focus on architectural features, cultural elements, and any identifying landmarks that would help international travelers understand the location."
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
