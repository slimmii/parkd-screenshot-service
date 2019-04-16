const captureWebsite = require('capture-website');
const system = require('system');
const http = require('http');
const path = require('path');
const url = require('url');
const express = require('express');
const isBinaryFileSync = require("isbinaryfile").isBinaryFileSync;
const fs = require('fs-extra');

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
                typeLabel: '{underline iphone|iphonex|google-pixel2|galaxy-s8}',
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
    { name: 'template', alias: 't', type: String, defaultValue: 'galaxy-s8' },
]

const options = commandLineArgs(optionDefinitions);
let screenshotDir = options.screenshotDir;
let outputDir = options.outputDir;
fs.ensureDirSync(outputDir);

console.log('Screenshot service tool');

let mappingFile = options.mappingFile;
let template = options.template;
let width = 1242;
let height = 2208;
if (template === 'iphonex') {
    width = 1242;
    height = 2688;
}
if (template === 'iphone') {
    width = 1242;
    height = 2208;
}


if (!screenshotDir) {
    console.log(usage)
    process.exit();
}

let files = scanDirectory(screenshotDir);

var screenshotPort = 0;
var resourcePort = 0;

var screenshotServer = express();
screenshotServer.use(express.static(screenshotDir));
var resourceServer = express();

resourceServer.get('*', function(req, res) {
    var filename = __dirname + '/html' + url.parse(req.url).pathname;
    try {
        if (fs.existsSync(filename)) {
            let isBinary = isBinaryFileSync(filename);
            if (isBinary) {
                res.sendFile(filename)
            }
            if (!isBinary) {
                let data = fs.readFileSync(filename, "utf8");
                if (data) {
                    Object.keys(req.query).forEach((key) => {
                       data = data.replace('__' + key + '__', req.query[key]);
                    });
                    res.end(data.toString());
                } else {
                    res.sendFile(filename)
                }
            }
        } else {
            res.sendStatus(404);
        }

    } catch(err) {
        res.sendStatus(500);
    }
});

var titleMapping = mappingFile ? JSON.parse(fs.readFileSync(mappingFile, 'utf-8')) : {};

async function createSnapshot(i) {
    var fileName = files[i];
    var title = titleMapping[fileName] || ' ';

    console.log('http://localhost:' + screenshotPort + '/' + fileName);

    await captureWebsite.file(
        'http://localhost:' + resourcePort + '/index.' + template + '.html?filePath=http://localhost:' + screenshotPort + '/' + fileName + '&title=' + title,
        outputDir + "/" + fileName,
        {overwrite: true, width:width , height: height, scaleFactor: 1 }
        );

    if (i < files.length) {
        await createSnapshot(i+1);
    } else {
        saveHtml();
        process.exit();
    }
}

function saveHtml() {
    var html = [];
    files.forEach((file) => {
            html.push("<img height='50%'  src='" + file + "'/>");
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

    await createSnapshot(0);


    //await instance.exit();
})();
