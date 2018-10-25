const phantom = require('phantom');
const system = require('system');
const http = require('http');

const fs = require('fs');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');


if (process.argv.length !== 6) {
    console.log("Usage: phantomjs export.js screenshot_dir output_dir mapping_file template)");
    return;
}

let screenshotDir = process.argv[2];
let outputDir = process.argv[3];
let mappingFile = process.argv[4];
let template = process.argv[5];
let files = scanDirectory(screenshotDir);

var serveScreenshots = serveStatic(screenshotDir);
var serveResources = serveStatic('html');

var screenshotServer = http.createServer(function (req, res) {
    var done = finalhandler(req, res);
    serveScreenshots(req, res, done);
});
var resourceServer = http.createServer(function (req, res) {
    var done = finalhandler(req, res);
    serveResources(req, res, done);
});


screenshotServer.listen(8000);
resourceServer.listen(8001);


//
var titleMapping = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));

async function createSnapshot(page, i) {
    var fileName = files[i];
    var title = titleMapping[fileName] || 'fleh';
    await page.open('http://localhost:8001/index.html?filePath=http://localhost:8000/' + fileName + '&title=' + title + '&device=' + template);
    await page.render(outputDir + "/" + fileName);

    if (i < files.length) {
        await createSnapshot(page, i+1);
    } else {
        process.exit();
    }
}

function scanDirectory(path) {
    let files = [];
    if (fs.statSync(path).isDirectory()) {
        fs.readdirSync(path).forEach(function (e) {
            if (e !== "." && e !== "..") {
                files.push(e);
            }
        });
    }
    return files;
};

(async function () {
    const instance = await phantom.create();
    const page = await instance.createPage();
    page.property('viewportSize', {width: 460, height: 820});
    page.on('onConsoleMessage', function (msg) {
        console.log(msg);
    });


    await createSnapshot(page, 0, 0);


    //await instance.exit();
})();
