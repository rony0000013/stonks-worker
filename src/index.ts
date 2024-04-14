import { Ai } from '@cloudflare/ai';
import { KVNamespace } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { cache } from 'hono/cache';

export type Env = {
	AI: Ai;
	my_kv: KVNamespace;
	API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

function get_cur_date() {
	const today = new Date();
	const dd = String(today.getDate()).padStart(2, '0');
	const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
	const yyyy = today.getFullYear();
	return `${yyyy}-${mm}-${dd}`;
}

async function put_stock_data(ticker: string, cur_date: string, API_KEY: string, kv: KVNamespace) {
	let url = new URL(`https://api.polygon.io/v3/reference/tickers/${ticker}`);
	url.search = new URLSearchParams({ apiKey: API_KEY }).toString();
	const response = await fetch(url);
	const res: any = await response.json();

	url = new URL(`https://api.polygon.io/v1/open-close/${ticker}/${cur_date}`);
	url.search = new URLSearchParams({ apiKey: API_KEY }).toString();
	const response2 = await fetch(url);
	const res2: any = await response2.json();

	const value = JSON.stringify({ ...res.results, ...res2.results });

	await kv.put(
		`INFO-${ticker}-${cur_date}`,
		value
		// { expirationTtl: 86400 }
	);
}

app.get(
	'*',
	cache({
		cacheName: 'my-app',
		cacheControl: 'max-age=86400',
	})
);

app.get('/', async (c) => {
	// return c.json(await c.env.my_kv.list())
	return c.text('Hello, World!');
});

app.get('/stock', async (c) => {
	const search = c.req.query('stock') || 'AAPL';

	const url = new URL('https://api.polygon.io/v3/reference/tickers');
	url.search = new URLSearchParams({
		search,
		market: 'stocks',
		apiKey: c.env.API_KEY,
	}).toString();
	const response = await fetch(url);
	let res: any = await response.json();
	res = res.results;
	res = res.map((x: any) => ({ name: x.name, ticker: x.ticker }));
	return c.json({ res });
});

app.get('/stocks/:ticker', async (c) => {
	const model = c.req.query('model') || '@hf/thebloke/zephyr-7b-beta-awq';
	const ticker = c.req.param('ticker') === null ? 'AAPL' : c.req.param('ticker');
	const cur_date = c.req.query('date') || get_cur_date();
	const ai = new Ai(c.env.AI);

	let value: string | null = '';
	try {
		value = await c.env.my_kv.get(`INFO-${ticker}-${cur_date}`);
		if (value === null) {
			await put_stock_data(ticker, cur_date, c.env.API_KEY, c.env.my_kv);
			value = await c.env.my_kv.get(`INFO-${ticker}-${cur_date}`);
		}
	} catch (err) {
		return c.text(`error: ${err}`, 500);
	}

	const res = await ai.run(model, {
		prompt: `Summarize the stock information in an easy to undertand way for a beginner. also include facts from the data. All numerical data should be in bold. Give the response in markdown format. Keep the result in 500 words. \n\n  Given the stock information as ${value}.`,
	});
	return c.text(res.response);
});

app.get('/news', async (c) => {
	const ticker = c.req.query('ticker') || 'AAPL';
	let results: string | null = await c.env.my_kv.get(`NEWS-${ticker}`);
	if (results === null) {
		const url = new URL('https://api.polygon.io/v2/reference/news');
		url.search = new URLSearchParams({
			ticker,
			apiKey: c.env.API_KEY,
		}).toString();
		const response = await fetch(url);
		let res: any = await response.json();
		res = res.results.map((x) => {
			return {
				article_url: x.article_url,
				description: x.description,
				image_url: x.image_url,
				title: x.title,
				keywords: x.keywords,
			};
		});
		results = JSON.stringify(res);

		await c.env.my_kv.put(`NEWS-${ticker}`, results, { expirationTtl: 86400 });
	}

	return c.json(JSON.parse(results));
});

app.get('/whisper', async (c) => {
	const ai = new Ai(c.env.AI);
	const blob = await c.req.arrayBuffer();

	const input = {
		audio: [...new Uint8Array(blob)],
	};

	const response = await ai.run('@cf/openai/whisper', input);

	return Response.json(response);
});

app.get('/chat', async (c) => {
	const model = c.req.query('model') || '@hf/thebloke/zephyr-7b-beta-awq';
	const text = c.req.query('text') || 'what is the meaning of life?';
	const cur_date = c.req.query('date') || get_cur_date();
	const symbol = c.req.query('ticker') || 'AAPL';
	const ai = new Ai(c.env.AI);

	let value: string | null = '';
	try {
		value = await c.env.my_kv.get(`INFO-${symbol}-${cur_date}`);
		if (value === null) {
			await put_stock_data(symbol, cur_date, c.env.API_KEY, c.env.my_kv);
			value = await c.env.my_kv.get(`INFO-${symbol}-${cur_date}`);
		}
	} catch (err) {
		return c.text(`error: ${err}`, 500);
	}
	const messages = [
		{
			role: 'system',
			content: `You are a stock assistant bot. your job is to assist with the stock market queries of the user. Be factual and do not generate false data. Here is the given context ${value}`,
		},
		{
			role: 'user',
			content: text,
		},
	];

	const res = await ai.run(model, {
		messages,
	});

	return c.text(res.response);
});

app.get('/sentiment', async (c) => {
	const text = c.req.query('text') || 'what is the meaning of life?';
	const ai = new Ai(c.env.AI);
	const res = await ai.run('@cf/huggingface/distilbert-sst-2-int8', {
		text: text,
	});
	const data = res.reduce((acc, item) => {
		acc[item.label] = item.score;
		return acc;
	}, {});
	return c.json(data);
});

app.get('/summarize', async (c) => {
	const text = c.req.query('text') || 'what is the meaning of life?';
	const ai = new Ai(c.env.AI);
	const res = await ai.run('@cf/facebook/bart-large-cnn', {
		input_text: text,
		max_length: 200,
	});
	return c.text(res.summary);
});

app.get('/translate', async (c) => {
	const lang = c.req.query('lang') || 'french';
	const text = c.req.query('text') || 'what is the meaning of life?';
	const ai = new Ai(c.env.AI);
	const res = await ai.run('@cf/meta/m2m100-1.2b', {
		text: text,
		source_lang: 'en',
		target_lang: lang,
	});
	if (res.translated_text) {
		return c.text(res.translated_text);
	}
});

app.get('/chart_data', async (c) => {
	const ticker = c.req.query('ticker') || 'AAPL';
	const cur_date = c.req.query('date') || get_cur_date();

	let value: string | null = null;
	try {
		value = await c.env.my_kv.get(`CHART-${ticker}-${cur_date}`);
		if (value === null) {
			const url = new URL(`https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/minute/${cur_date}/${cur_date}`);
			url.search = new URLSearchParams({ apiKey: c.env.API_KEY, sort: 'asc' }).toString();
			const response = await fetch(url);
			const res: any = await response.json();
			const data = res.results;

			const x = data.map((item) => item.t.toString());
			const open = data.map((item) => item.o);
			const high = data.map((item) => item.h);
			const low = data.map((item) => item.l);
			const close = data.map((item) => item.c);
			value = { x, open, high, low, close };
			await c.env.my_kv.put(`CHART-${ticker}-${cur_date}`, JSON.stringify(value));
		} else {
			value = JSON.parse(value);
		}
	} catch (err) {
		return c.text(`error: ${err}`, 500);
	}

	return c.json(value);
});

app.get('/generate_image', async (c) => {
	const model = c.req.query('model') || '@cf/bytedance/stable-diffusion-xl-lightning';
	const prompt = c.req.query('prompt') || 'a photograph of an astronaut riding a horse';

	const ai = new Ai(c.env.AI);

	const res = await ai.run(model, { prompt });
	return new Response(res, {
		headers: {
			'content-type': 'image/png',
		},
	});
});

export default app;
