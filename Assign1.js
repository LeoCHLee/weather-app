"use strict";
const API_KEY = "afeeefb282b7f09192ad7e39b9ed26bf";
const express = require('express');
const https = require('https');
const path = require("path");

const app = express();
const port = 3000;

let publicPath = path.resolve(__dirname, "public");
console.log(publicPath);
app.use(express.static(publicPath));

app.get('/', function (req, res) {
    res.sendFile(publicPath + "/Assign1.html");
});

//Main function for weather data handling
function daily_weather(data) {
    let daily = [];
    let rain = false;

    // Loop through the 8 data points per day for 3 days
    for (let i = 0; i < 24; i += 8) {
        let day_data = data.slice(i, i + 8);
        let total_temp = 0;
        let num_entries = day_data.length;

        // Getting average temp for the days
        for (let i = 0; i < num_entries; i++) {
            total_temp += day_data[i].main.temp;
        }

        let average_temp = total_temp / num_entries;
        // Extracting description to check for rain
        let description = day_data[0].weather[0].description;

        let iconCode = day_data[0].weather[0].icon;

        if (description.toLowerCase().includes('rain')) {
            rain = true;
        }

        // Sort Temperatures
        let tempCategory = '';
        if (average_temp < 8) {
            tempCategory = 'cold';
        } else if (average_temp >= 8 && average_temp <= 24) {
            tempCategory = 'mild';
        } else {
            tempCategory = 'hot';
        }


        //set object data and push to end of array
        daily.push({
            date: new Date(day_data[0].dt * 1000).toDateString(),
            average_temp: average_temp.toFixed(2),
            description: description,
            tempCategory: tempCategory,
            iconCode: iconCode
        });
    }
    return { daily, rain };
}

//This needs to be run asynchronously as the pollution data can only be gotten after the city data
app.get('/Search/:city', async (req, res) => {
    //city name for URL
    const city_name = req.params.city;

    //url must be set here for city_name
    const API_URL = `https://api.openweathermap.org/data/2.5/forecast?q=${city_name}&appid=${API_KEY}&units=metric`;

    try {
        //Get the weather data and parse it
        let weather_data = await get_data(API_URL);
        let parsed_data = JSON.parse(weather_data);

        if (parsed_data.cod === '404') {
            return res.status(404).json({ error: "City not found" });
        }

        //call weather data handling function to sort
        let { daily, rain } = daily_weather(parsed_data.list);

        //some api parameters take lat and lon
        let { lat, lon } = parsed_data.city.coord;

        //URL must be set here for lat and lon
        const POLLUTION_API_URL = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;


        //Get the pollution Data from API
        let pollution_data = await get_data(POLLUTION_API_URL);
        let parsed_pollution_data = JSON.parse(pollution_data);
        let pollution_index = parsed_pollution_data.list[0].main.aqi;
        let pollution = get_pollution_info(parsed_pollution_data.list[0].components);



        //making package to respond with
        res.json({
            city: parsed_data.city.name,
            country: parsed_data.city.country,
            daily: daily,
            rain: rain,
            pollution: pollution,
            pollution_index: pollution_index
        });

        //error handling
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to retrieve data" });
    }
});

//Built-in Asynchronous function for getting data from url -> 'https.get' then some data handling and whatnot
function get_data(url) {
    return new Promise((fulfill, reject) => {
        https.get(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                fulfill(data);
            });

        }).on('error', (error) => {
            reject(error);
        });
    });
}

function get_pollution_info(components) {

    //reset
    let high_pollutant = null;
    let high_concentration = 0;


    //dictionary for pollutant and concentration
    for (let [pollutant, concentration] of Object.entries(components)) {
        if (concentration > high_concentration) {
            high_concentration = concentration;
            high_pollutant = pollutant;
        }
    }

    //package of ollutants
    const pollutants = {
        co: "Carbon Monoxide (CO)",
        no: "Nitrogen Monoxide (NO)",
        no2: "Nitrogen Dioxide (NO₂)",
        o3: "Ozone (O₃)",
        so2: "Sulfur Dioxide (SO₂)",
        pm2_5: "Fine Particles (PM2.5)",
        pm10: "Coarse Particles (PM10)",
        nh3: "Ammonia (NH₃)"
    };

    return {
        high_pollutant: pollutants[high_pollutant] || "Unknown",
        concentration: high_concentration
    };
}

app.listen(port, () => console.log(`Weather app listening on port ${port}!`));
