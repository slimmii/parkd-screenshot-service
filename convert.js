const phantom = require('phantom');
const system = require('system');
const http = require('http');

const fs = require('fs');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage')
const portscanner = require('portscanner')


const sections = [
    {
        header: 'Screenshot App',
        content: 'Generates screenshots for the PARKD team.'
    },
    {
        header: 'Options',
        optionList: [
            {
                name: 'screenshotDir',
                typeLabel: '{underline directory}',
                description: 'Directory containing screenshots'
            },
            {
                name: 'outputDir',
                typeLabel: '{underline directory}',
                description: 'Directory where the screenshots should be stored'
            },
            {
                name: 'mappingFile',
                typeLabel: '{underline file}',
                description: 'The mapping file'
            },
            {
                name: 'template',
                typeLabel: '{underline ios|android}',
                description: 'The template'
            },
            {
                name: 'help',
                description: 'Print this usage guide.'
            }
        ]
    }
]
const usage = commandLineUsage(sections)

const optionDefinitions = [
    { name: 'help', alias: 'h'},
    { name: 'screenshotDir', alias: 's', type: String, defaultOption: true },
    { name: 'outputDir', alias: 'o', type: String, defaultValue: 'output' },
    { name: 'mappingFile', alias: 'm', type: String, defaultValue: null },
    { name: 'template', alias: 't', type: String, defaultValue: 'ios' },
]

const options = commandLineArgs(optionDefinitions);
let screenshotDir = options.screenshotDir;
let outputDir = options.outputDir;
let mappingFile = options.mappingFile
let template = options.template;

if (!screenshotDir) {
    console.log(usage)
    process.exit();
}

let files = scanDirectory(screenshotDir);

var screenshotPort = 0;
var resourcePort = 0;
var serveScreenshots = serveStatic(screenshotDir);
var serveResources = serveStatic(__dirname + '/html');

var screenshotServer = http.createServer(function (req, res) {
    var done = finalhandler(req, res);
    serveScreenshots(req, res, done);
});
var resourceServer = http.createServer(function (req, res) {
    var done = finalhandler(req, res);
    serveResources(req, res, done);
});

var titleMapping = mappingFile ? JSON.parse(fs.readFileSync(mappingFile, 'utf-8')) : {};

async function createSnapshot(page, i) {
    var fileName = files[i];
    var title = titleMapping[fileName] || 'fleh';
    await page.open('http://localhost:' + resourcePort + '/index.html?filePath=http://localhost:' + screenshotPort + '/' + fileName + '&title=' + title + '&device=' + template);
    await page.render(outputDir + "/" + fileName);

    if (i < files.length) {
        await createSnapshot(page, i+1);
    } else {
        saveHtml();
        process.exit();
    }
}

function saveHtml() {
    console.log('saveHtml');
    var html = [];
    files.forEach((file) => {
            html.push("<img src='" + file + "'/>");
    });

    console.log(html.join(""));
    fs.writeFileSync(outputDir + "/report.html", html.join(""));
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

async function getNextAvailablePort(min) {
    let port = await new Promise((resolve, reject) => {
        portscanner.findAPortNotInUse(min, 4000, function (error, port) {
            resolve(port)
        })
    });
    return port;
}

(async function () {
    screenshotPort = await getNextAvailablePort(3000);
    resourcePort = await getNextAvailablePort(screenshotPort+1);

    screenshotServer.listen(screenshotPort);
    resourceServer.listen(resourcePort);

    console.log('Screenshot server started on port ' + screenshotPort);
    console.log('Resource server started on port ' + resourcePort);


    const instance = await phantom.create();
    const page = await instance.createPage();
    page.property('viewportSize', {width: 460, height: 820});
    page.on('onConsoleMessage', function (msg) {
        console.log(msg);
    });


    await createSnapshot(page, 0, 0, screenshotPort, resourcePort);


    //await instance.exit();
})();
