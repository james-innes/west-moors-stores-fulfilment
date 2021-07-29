<script>
	import { onMount } from "svelte";
	import firebase from "firebase/app";
	import "firebase/auth";
	import "firebase/firestore";

	firebase.initializeApp({
		apiKey: "AIzaSyDslUEpSW-kixymhjTZR7Xx93PCrNotqWY",
		authDomain: "stores-304611.firebaseapp.com",
		projectId: "stores-304611",
		appId: "1:20494736032:web:2d8c9356c225956af4c7c5",
		measurementId: "G-30XDYGJCY9",
	});

	// firebase.auth().getRedirectResult();
	// firebase
	// 	.auth()
	// 	.onAuthStateChanged(
	// 		user =>
	// 			!user &&
	// 			firebase
	// 				.auth()
	// 				.signInWithRedirect(new firebase.auth.GoogleAuthProvider())
	// 	);

	const db = firebase.firestore();

	let d = new Date(),
		today = d.toDateString();
	let purchase = "";

	// Packaging

	import Quagga from "quagga";
	let scannerRef;
	let scanning = false;
	let packing = [];
	let lastScanned;
	let lastScannedTime;
	let a, o, g;

	$: packed = [];
	$: choices = [];
	$: box = null;

	function audio() {
		let AudioContext = window.AudioContext || window.webkitAudioContext;
		a = new AudioContext();
	}

	function beep() {
		o = a.createOscillator();
		g = a.createGain();
		o.connect(g);
		o.type = "square";
		o.frequency.value = 620;
		g.connect(a.destination);
		o.start(a.currentTime);
		o.stop(a.currentTime + 0.15);
	}

	db.collection("scanner")
		.doc("latest")
		.onSnapshot(doc => (packed = doc.data().packed));

	function scan() {
		Quagga.init(
			{
				numOfWorkers: 4,
				frequency: 10,
				locate: true,
				inputStream: {
					name: "Live",
					type: "LiveStream",
					target: scannerRef,
					constraints: {
						width: innerHeight - 18 * 16,
						height: innerWidth - 2 * 16,
						facingMode: "environment",
						frameRate: 10,
					},
				},
				decoder: {
					readers: ["ean_reader"],
				},
				locator: {
					patchSize: "medium",
				},
			},
			err => (err && alert(err), Quagga.start())
		);

		scanning = true;

		Quagga.onDetected(r => {
			let barcode = r.codeResult.code;
			const now = new Date().getTime();
			if (barcode === lastScanned && now < lastScannedTime + 5000) {
				return;
			}
			beep();
			lastScanned = barcode;
			lastScannedTime = now;
			onBarcode(barcode);
		});

		Quagga.onProcessed(
			() => (Quagga.canvas.dom.overlay.style.display = "none")
		);
	}

	function onBarcode(barcode) {
		if (choices.length > 1) {
			alert("Complete your choice first");
			return;
		}

		choices = Array.from(
			new Set(
				packing
					.filter(p => p.barcode == barcode)
					.filter(
						p =>
							packing.filter(_p => _p.code == p.code).length !=
							packed.filter(_p => _p.code == p.code).length
					)
					.map(p => p.code)
			)
		).map(code => packing.find(p => p.code === code));

		if (choices.length == 0) {
			box = null;
			alert("Can't find a product with the barcode:\n" + barcode);
		}

		if (choices.length == 1) {
			findBox(choices[0].code);
		}
	}

	function findBox(code) {
		let sameCodeCount = packed.filter(p => p.code == code).length;
		box = packing.filter(p => p.code == code)[
			sameCodeCount == 0 ? 0 : sameCodeCount
		];

		db.collection("scanner")
			.doc("latest")
			.set({
				packed: [...packed, box],
			});

		choices = [];
	}

	// Delivery

	let map, mapRef;
	let delivery = [];
	let garmin = "";

	$: delivery &&
		delivery.map(
			(order, i) =>
				new google.maps.Marker({
					position: order.location,
					label: { text: String(i + 1), color: "#23d19a", fontWeight: "500" },
					icon: {
						path: "M12,2.016C13.937,2.016 15.586,2.696 16.945,4.055C18.304,5.414 18.984,7.063 18.984,9C18.984,9.969 18.742,11.078 18.257,12.328C17.772,13.578 17.186,14.75 16.499,15.844C15.812,16.938 15.132,17.961 14.46,18.914C13.788,19.867 13.218,20.624 12.749,21.187L11.999,21.984C11.812,21.765 11.562,21.476 11.249,21.117C10.936,20.758 10.374,20.039 9.561,18.961C8.748,17.883 8.037,16.836 7.428,15.82C6.819,14.804 6.264,13.656 5.764,12.375C5.264,11.094 5.014,9.969 5.014,9C5.014,7.063 5.694,5.414 7.053,4.055C8.412,2.696 10.061,2.016 11.998,2.016L12,2.016Z",
						fillColor: "#e2ffee",
						fillOpacity: 1,
						strokeWeight: 2,
						strokeColor: "#23d19a",
						scale: 2,
						anchor: new google.maps.Point(15, 30),
						labelOrigin: new google.maps.Point(12, 10),
					},
					map,
				})
		);

	onMount(() => {
		map = new google.maps.Map(mapRef, {
			mapId: "7554b4d98478747e",
			disableDefaultUI: true,
		});

		map.fitBounds({
			north: 50.824048,
			south: 50.820123,
			east: -1.886569,
			west: -1.891698,
		});
	});

	fetch("/.netlify/functions/fulfillment")
		.then(r => r.json())
		.then(d => ({ delivery, packing, purchase, garmin } = d));
</script>

<h2>Purchase</h2>
<p>
	Upload the barcodes <a
		href="data:,{purchase}"
		download="{today} Stores Barcodes.txt">file</a
	>
	to the scanner
	<a href="https://www.booker.co.uk/scanner/uploadcs3000" target="_blank"
		>page</a
	>
	and complete checkout.
	<br />
	You can
	<a
		href="data:,{JSON.stringify(delivery, null, 2)}"
		download="{today} Stores Orders.txt">view/print</a
	> all the orders this week.
</p>

<h2>Packing</h2>

<p>
	Number of boxes needed: <b>{delivery?.length}</b>
	<br />Scan products and place in the box number shown.
</p>

<details>
	<summary>History</summary>
	<table>
		<tr>
			<th>Name</th>
			<th>Code</th>
			<th>Barcode</th>
		</tr>
		{#each packed as { code, barcode, name }}
			<tr>
				<td>
					{name}
				</td>
				<td>
					{code}
				</td>
				<td>
					{barcode}
				</td>
			</tr>
		{/each}
	</table>
</details>

<label style="width: 15rem">
	Add Barcode
	<input
		on:keydown={e =>
			(e.key === "Tab" || e.key === "Enter") &&
			(e.preventDefault(), onBarcode(e.target.value), (e.target.value = ""))}
	/>
</label>

<button
	on:click={() =>
		scanning ? (Quagga.stop(), (scanning = false)) : (audio(), scan())}
	>{scanning ? "Stop" : "Start"}</button
>

<button
	on:click={() => {
		db.collection("scanner")
			.doc("latest")
			.set({ packed: [] })
			.then(() => location.reload());
	}}
	type="reset">Clear</button
>

<div class="scanned">
	{#if choices.length > 1}
		<div class="choices">
			{#each choices as { img, name, code }}
				<div class="choice">
					<img src={img} alt />
					<p>
						{name}
					</p>
					<button on:click={() => findBox(code)}>Pick</button>
				</div>
			{/each}
		</div>
	{:else if box}
		{#key box}
			<div class="result">
				<p style="font-size: 8rem">
					{box.orderIndex}
				</p>
				<p>
					{box.name}
				</p>
			</div>
		{/key}
	{:else}
		<div class="result">
			<p style="font-size: 9rem">?</p>
		</div>
	{/if}
</div>

<div bind:this={scannerRef} />

<h2>Delivery</h2>

<p>
	The orders are sorted for an optimised route. <br /> Garmin SatNav
	<a href="data:,{garmin}" download="{today} Stores Route.gpx">GPX Route file</a
	> should be placed in /GPX directory.
</p>

<table>
	{#each delivery as { address }, i}
		<tr>
			<td>
				<b>
					{i + 1}.
				</b>
			</td>
			<td>
				<a href="https://maps.google.com/?q={address}" target="_blank"
					>{address}</a
				>
			</td>
		</tr>
	{/each}
</table>

<div bind:this={mapRef} class="map" />

<button on:click={() => map.setCenter(delivery[0].location)}>Center</button>
<button on:click={() => map.setMapTypeId("hybrid")}>Satellite</button>
<button on:click={() => map.setMapTypeId("roadmap")}>Vector</button>
<button on:click={() => map.setZoom(map.getZoom() + 1)}>&plus</button>
<button on:click={() => map.setZoom(map.getZoom() - 1)}>&minus</button>

<style global lang="scss">
	@import "styles";

	.scanned {
		height: 15rem;
		border: $thick solid #f3f5f5;
		margin-bottom: 1rem;

		p {
			margin: 0;
			line-height: 100%;
			overflow: hidden;
		}

		.choice,
		.result {
			display: flex;
			flex-direction: column;
			align-items: center;
			text-align: center;
		}

		.result {
			animation: blink 1s ease-out;
		}

		@keyframes blink {
			50% {
				background: $light;
			}
		}

		.choices {
			display: flex;
			flex-wrap: nowrap;
			overflow-x: auto;
			height: 100%;

			.choice {
				flex: 0 0 auto;
				justify-content: space-between;
				margin: 1rem;
				width: 10rem;

				img {
					height: 7rem;
				}

				button {
					margin-bottom: 0;
				}
			}
		}

		.result {
			height: 100%;
			justify-content: center;
		}
	}

	table {
		white-space: nowrap;
	}

	.map {
		height: 60vh;
		margin: 1rem 0 0 0;
	}
</style>
