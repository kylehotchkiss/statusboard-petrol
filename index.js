//
// statusboard-petrol
// Copyright 2014 Kyle Hotchkiss
// Released under the GPL
//
var knox = require("knox");
var config = require("./config.json");
var moment = require("moment");
var request = require("request");


//
// Grab Tweets
//
request.get({
    json: true,
    url: "https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=" + config.twitterUser + "&count=200",
    oauth: {
        callback: config.twitterCallback,
        consumer_key: config.twitterKey,
        consumer_secret: config.twitterSecret,
        token: config.twitterToken,
        token_secret: config.twitterTokenSecret
    }
}, function( error, response, body ) {
    var today = moment().startOf("day");
    var twitter = body;
    var prices = [];
    var dataSet = [];

    // Extract price data from tweets
    for ( var i = (twitter.length - 1); i > 0 ; i-- ) {
        var tweet = twitter[i];
        var created = moment( new Date(tweet.created_at) );

        if ( today.diff( created, "days" ) < 7 ) {
            var text = tweet.text;
            var dateSlug = created.format("MMM D");

            // We use #burn for all gas prices
            // which allows us to use twitter for several
            // different things.
            if ( text.indexOf( config.twitterHashtag ) !== -1 ) {
                var price = parseFloat( text.replace("$", "").replace(" " + config.twitterHashtag, "") );

                if ( typeof prices[dateSlug] !== "undefined" ) {
                    prices[dateSlug] += price;
                } else {
                    prices[dateSlug] = price;
                }
            }
        }
    }

    // Create a Panic-statusboard friendly JSON set
    for ( var j in prices ) {
        var date = j;
        var price = prices[j];

        dataSet.push({
            title: date,
            value: price.toFixed(3)
        })
    }

    // Create Statusboard Object
    var statusboard = {
        graph: {
            title: config.graphTitle,
            yAxis: {
                units: {
                    prefix: "$"
                }
            },
            datasequences: [{
                title: config.graphLabel,
                color: config.graphColor,
                datapoints: dataSet
            }]
        }
    }

    // Make it JSON-able
    var content = JSON.stringify( statusboard );

    var s3 = knox.createClient({
        key: config.awsKey,
        secret: config.awsSecret,
        bucket: config.awsBucket
    });

    var s3_write = s3.put( config.awsPath, {
        "Content-Length": unescape( encodeURIComponent( content )).length,
        "Content-Type": "application/json",
        "x-amz-acl": "public-read"
    });

    s3_write.end( content );

    s3_write.on("response", function( response ) {
        if ( response.statusCode !== 200 ) {
            console.error("S3 Publish: Failed");
        }
    });
});