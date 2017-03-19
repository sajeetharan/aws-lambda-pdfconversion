var dstBucket = null;
var dstKey = null;
var srcFileKey = null;
var AWS = require('aws-sdk');
var fs = require('fs');
var s3 = new AWS.S3();
var local_stored_pdf = null;
 

function upload(bucket, sourceFile, key, filename, content_type, cb) {
        s3.putObject({
                Bucket: bucket,
                Key: key,
                Body: fs.createReadStream(filename),
                ContentType: content_type
        }, function (err, data) {
                console.log(err);
                cb(err, data);
        });        
        
}

function uploadImages(context, _images, cb) {
        numCompleted = 1;
        for (var i = 1; i <= _images; i++) {
                console.log(_images);
                console.log(dstKey + "/" + srcFilename + "_" + i);
                upload(dstBucket, srcFilename, dstKey + "/images/" + i + ".jpeg", "/tmp/" + i + ".jpeg", "image/jpeg", function (err, data) {
                        numCompleted++;
                        if (numCompleted > _images) {
                                cb();
                        }
                });
        }
}
exports.handler = function (event, context) {

        console.log("event records:" + JSON.stringify(event.Records[0]));
        var srcBucket = event.Records[0].s3.bucket.name;
        var srcKey = event.Records[0].s3.object.key;
        dstBucket = srcBucket;
        console.log(srcBucket);
        var srcFilenameArr = srcKey.split(".");
        srcFileKey = srcFilenameArr[0];
        var srcFileExt = srcFilenameArr[1].toLowerCase();
        srcFilename = srcFileKey.substring(srcFileKey.lastIndexOf('/') + 1);
        dstKey = srcFileKey.substring(0, (srcFileKey.lastIndexOf('/') > 0 ? srcFileKey.lastIndexOf('/') : srcFileKey.length));
        stored_pdf = "/tmp/" + srcFilename + ".pdf";
        console.log("PDF to Images and Uploading....");
        console.log(stored_pdf);
        var validFileTypes = ['pdf'];
        if (validFileTypes.indexOf(srcFileExt) < 0) {
                context.done(null, {
                        status: false,
                        message: 'File extension does not match.'
                });
        }
        s3.getObject({
                Bucket: srcBucket,
                Key: srcKey
        }, function (err, data) {
                if (err) {
                        console.log(err);
                        context.done(null, {
                                status: false,
                                message: 'Unable to download the file.'
                        });
                } else {
                        console.log('file downloaded...');
                        fs.writeFile(stored_pdf, data.Body, {
                                encoding: null
                        }, function (fserr) {
                                console.log("fserr: " + fserr)
                                if (fserr) {

                                        context.done(null, {
                                                status: false,
                                                message: 'Unable to copy file into tmp directory.'
                                        });
                                } else {
                                        console.log('File Downloaded! ' + data.ContentType);
                                        const testFolder = '/tmp/';
                                        fs.readdir(testFolder, (err, files) => {
                                                console.log(files);
                                        })
                                        var exec = require('child_process').exec,
                                                child;
                                        child = exec('gs -sDEVICE=jpeg -dTextAlphaBits=4 -r300 -o /tmp/%d.jpeg ' + stored_pdf, function (error,
                                                stdout, stderr) {
                                                console.log('stdout: ' + stdout);
                                                console.log('stderr: ' + stderr);
                                                if (error !== null) {
                                                        console.log('exec error: ' + error);
                                                        context.done(null, {
                                                                status: false,
                                                                message: 'Error in creating images.'
                                                        });
                                                } else {
                                                        console.log('images created...');
                                                        child = exec('gs -q  -dNODISPLAY  -c "(' + stored_pdf +
                                                                ') (r) file runpdfbegin pdfpagecount = quit"',
                                                                function (error, stdout, stderr) {
                                                                        if (error !== null) {
                                                                                console.log('exec error: ' + error);
                                                                                context.done(null, {
                                                                                        status: false,
                                                                                        message: 'Error in getting pdf page count.'
                                                                                });
                                                                        } else {
                                                                                console.log('pages count:' + stdout);
                                                                                uploadImages(context, stdout, function () {
                                                                                        context.done(null, {
                                                                                                status: true,
                                                                                                message: "PDF conversion done successfully"
                                                                                        });
                                                                                });
                                                                        }
                                                                });
                                                }
                                        });
                                }
                        });
                }
        });

};