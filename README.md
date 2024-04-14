# Stonks App Worker

## Description

This repository contains the code for a Cloudflare Worker of the stonks app. stonks app is a beginner friendly app for getting stock information of various stocks.

## Features

- **Stock Summary**: Get a comprehensive overview of stocks, including daily price charts and essential information.

- **Multi-Language Support**: Access stock information in multiple languages, ensuring accessibility for a global audience.

- **News and Sentiment Analysis**: Stay up-to-date with recent news related to stocks, accompanied by sentiment analysis for better decision-making.

- **Customizable Date**: Users can customize the date to obtain stock information tailored to their specific needs.

- **LLM Model Selection**: Choose from various Large Language Models (LLMs) to generate stock information based on individual preferences.

## Getting Started

To get started with this Cloudflare Worker, follow these steps:

1. Clone this repository:

    ```bash
    git clone https://github.com/your-username/your-repo.git
    ```

2. Install the required dependencies:

    ```bash
    npm install
    ```

3. Configure your [**Cloudflare**](https://cloudflare.com/) account and obtain your API credentials (Workers AI, Cloudflare KV) and also configure and add api key of [**Polygon.io**](https://polygon.io)

4. Update the `wrangler.toml` file with your Cloudflare account details and Ploygon API key.

    ```toml
    [vars]
    API_KEY = "<polygon-api-key>"
    [[kv_namespaces]]
    binding = "<name-of-kv-instance>"
    id = "<kv-instance-id>"
    ```

5. Run your worker locally using wrangler:

    ```bash
    npm run dev
    ```

6. Deploy the worker to Cloudflare Workers using Wrangler:

    ```bash
    npm run deploy
    ```

## Usage

Once the worker is deployed, it will start intercepting requests based on the specified route(s) in the `index.ts` file.

Routes of the worker:

- `/` base path

- `/stock` to search for stocks it takes query `{ stock: string }`

- `/stocks/:ticker` to get for summary of the stock it takes query `{model: string, date: sring, ticker: string}`

- `/news` to get news for a stock it takes query `{ ticker: string}`

- `/whisper` to convert audio to text it takes body of audio file

- `/chat` to chats with user about a stock it takes query `{ ticker: string, date: string, model: string, text: string}`

- `/sentiment` to get sentiment from a text it takes query `{ text: string}`

- `/summarize` to get summary for a text it takes query `{ text: string}`

- `/translate` to translate a text it takes query `{ lang: string, text: string}`

- `/chart_data` to get chart data for a stock it takes query `{ ticker: string, date: string}`
- `/generate_image` to generate an image from text it takes query `{ text: string}`

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
