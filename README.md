🌌 Granthika – AI Chat Application (Gemini Powered)

Granthika is a modern AI-powered chat application built with React + Vite and powered by Google Gemini API.

It supports real-time chat, multiple modes, and clean UI components, with a working Gemini integration using the latest supported models.



🚀 Features

🤖 AI Chat powered by Google Gemini



⚡ Fast frontend using React + Vite



🧠 Supports Gemini generateContent API



📂 Clean modular code structure



🖥️ Modern UI with sidebar \& chat cards



🔐 Secure API key usage via environment variables



🛠️ Tech Stack

Frontend: React, TypeScript, Vite



AI API: Google Gemini (Generative Language API)



Styling: Tailwind CSS



Icons: Lucide React



📁 Project Structure

Granthika/

│

├── src/

│   ├── components/

│   │   ├── Sidebar.tsx

│   │   ├── MessageCard.tsx

│   │   └── PDFUpload.tsx

│   │

│   ├── lib/

│   │   └── gemini.ts

│   │

│   ├── App.tsx

│   └── main.tsx

│

├── .env

├── package.json

├── vite.config.ts

└── README.md

🔑 Environment Variables

Create a .env file in the root directory:



VITE\_GEMINI\_API\_KEY=YOUR\_GOOGLE\_GEMINI\_API\_KEY

⚠️ Never commit your API key to GitHub



🤖 Gemini Integration (Working)

This project uses the REST API with a verified working model:



✅ Supported Model Used

gemini-2.5-flash

📌 Endpoint

https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent

📄 gemini.ts (Final Working Code)

export async function askGemini(prompt: string): Promise<string> {

&nbsp; const apiKey = import.meta.env.VITE\_GEMINI\_API\_KEY;



&nbsp; const res = await fetch(

&nbsp;   `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,

&nbsp;   {

&nbsp;     method: "POST",

&nbsp;     headers: {

&nbsp;       "Content-Type": "application/json",

&nbsp;     },

&nbsp;     body: JSON.stringify({

&nbsp;       contents: \[

&nbsp;         {

&nbsp;           parts: \[{ text: prompt }],

&nbsp;         },

&nbsp;       ],

&nbsp;     }),

&nbsp;   }

&nbsp; );



&nbsp; const data = await res.json();



&nbsp; return (

&nbsp;   data?.candidates?.\[0]?.content?.parts?.\[0]?.text ??

&nbsp;   "⚠️ No response from Gemini"

&nbsp; );

}

▶️ How to Run Locally

npm install

npm run dev

Open in browser:



http://localhost:5173

🧪 API Testing (Verified)

The Gemini API was tested using Postman with the following request:



Body:



{

&nbsp; "contents": \[

&nbsp;   {

&nbsp;     "parts": \[

&nbsp;       { "text": "Write a short poem about the ocean." }

&nbsp;     ]

&nbsp;   }

&nbsp; ]

}

✅ Successful response confirms correct model and API key usage.



❗ Common Errors Solved

❌ 404 Model Not Found → Fixed by using gemini-2.5-flash



❌ API\_KEY\_INVALID → Fixed by correct API key from Google AI Studio



❌ Browser CORS issues → Avoided by correct REST endpoint usage



📌 Notes

No backend server is required if using REST API directly



Always verify models using List Models API



Restart dev server after .env changes



📜 License

MIT License © 2025

