# Debugging stractura 
Stractura depends on event driven architecture with postMessage apis on the presentational layer, and piority queue on the backend. 

To debug the best way is to place console.log with stractura prefix and the name of the layer at which you are debugging. 

alt + ctrl + g on a file in source code to open webview

Then to view the logs click on ctrl + shift + p then click on: 
> Developer: open webview Developer Tools

From the web view click on console, and you will see the logs there. Try to place as many cnsole.log as possible from top down, top being the backend, down being the frontend. 