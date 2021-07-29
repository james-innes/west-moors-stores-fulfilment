const axios = require("axios");
const https = require("https");
const js2xmlparser = require("js2xmlparser");
const { startOfWeek, endOfWeek, sub, getTime } = require("date-fns");
const { MongoClient, ObjectId } = require("mongodb");
const mongo = new MongoClient(process.env.MONGO);

const now = new Date();
const d = d => ObjectId.createFromTime(getTime(sub(d, { weeks: 1 })) / 1000);

exports.handler = async () => {
	try {
		const orders = await mongo.connect().then(() =>
			mongo
				.db("stores")
				.collection("order")
				// Only get the previous weeks orders
				// .find({
				// 	_id: {
				// 		$gte: d(startOfWeek(now, { weekStartsOn: 6 })),
				// 		$lte: d(endOfWeek(now, { weekStartsOn: 6 })),
				// 	},
				// })
				.find()
				.toArray()
				.then(r => r, mongo.close())
		);

		const purchase = Array.from(
			orders
				.map(order => order.basket)
				.flat()
				.reduce(
					(m, { code, qty }) => m.set(code, (m.get(code) || 0) + qty),
					new Map()
				),
			([code, qty]) => ({ code, qty })
		)
			.map(p => `10/01/20,00:00:00,00,${p.barcode}%0D%0A`.repeat(p.qty))
			.join("");

		const packing = await orders.reduce(
			(acc, order, i) =>
				acc.concat(
					order.basket
						.map(p => {
							let multi = [];
							let _p = {
								...p,
								orderIndex: i + 1,
							};
							for (let c = 0; c < p.qty; c++) multi.push(_p);
							return multi;
						})
						.flat()
				),
			[]
		);

		const vehicles = [
			{
				id: 1,
				profile: "driving-car",
				start: [-1.8907089391406915, 50.821375666821886],
				end: [-1.8907089391406915, 50.821375666821886],
				capacity: [4],
				skills: [1],
			},
		];

		const jobs = await orders.map((order, i) => ({
			id: i,
			description: order._id,
			amount: [1],
			location: Object.values(order.location).reverse(),
			skills: [1],
		}));

		const route = await axios({
			url: "https://api.openrouteservice.org/optimization",
			method: "POST",
			headers: {
				Accept:
					"application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
				Authorization: process.env.ORS,
				"Content-Type": "application/json; charset=utf-8",
			},
			httpsAgent: new https.Agent({
				rejectUnauthorized: false,
			}),
			data: {
				jobs,
				vehicles,
			},
		}).then(r => r.data);

		const delivery = await route.routes[0].steps.slice(1, -1).map(step => ({
			...orders.find(
				o => o._id == jobs.find(j => j.id == step.job).description
			),
			delivery: step,
		}));

		const garmin = js2xmlparser.parse(
			"gpx",
			{
				"@": {
					"xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
					version: "1.0",
					creator: "Stores",
					xmlns: "http://www.topografix.com/GPX/1/0",
					"xsi:schemaLocation":
						"http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd",
				},
				rte: {
					name: {
						"#": "Stores " + now,
					},
					rtept: orders
						.map(order => ({
							"@": order.location,
							name: {
								"#": order.address,
							},
						}))
						.flat(),
				},
			},
			{
				declaration: {
					encoding: "utf-8",
				},
			}
		);

		return {
			statusCode: 200,
			body: JSON.stringify({
				purchase,
				packing,
				delivery,
				garmin,
			}),
		};
	} catch (e) {
		return {
			statusCode: 500,
			body: JSON.stringify(e),
		};
	}
};
