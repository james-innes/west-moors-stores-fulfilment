# West Moors Stores Fulfillment

_The Firebase Google Auth and Firestore realtime DB for the scanner is currently disabled._

The system takes all the orders for the previous week to be delivered on the weekend.

Purchase section creates a purchase order file that can be uploaded to the wholesaler website.

Scan a product's barcode using a laptop and plugged in scanner with the cursor in the barcode input or by using the camera on a smartphone. QuaggaJs is used to decode the barcode image data.

Realtime database used to allow multiple people to scan products at the same time on different devices.

If multiple products have the same barcode (more often then you think) then pictures are shown to select the right one.

When a product is picked and scanned the number shown indicates the number of the box to place the item in for delivery.

The addresses for the deliveries are optimized for the fastest route using the Open Routing Service. The Delivery list is ordered and the map shows the first order to make from the sorting location.

![](/photo.jpg)
