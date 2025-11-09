const axios = require('axios');
const moment = require('moment-timezone');

module.exports = {
    name: 'weather',
    aliases: ['meteo', 'climat', 'temps'],
    category: 'tools',
    description: 'Affiche les informations météorologiques d\'une ville',
    usage: '.weather <ville>',
    cooldown: 10,
    adminOnly: false,
    groupOnly: false,
    privateOnly: false,
    ownerOnly: false,
    hidden: false,

    async execute(socket, msgInfo, handler) {
        const { from, args } = msgInfo;

        if (!args.length) {
            return await handler.reply(from,
                `❌ *Nom de ville requis*\n\n` +
                `📝 *Usage:* ${handler.config.PREFIX}weather <ville>\n\n` +
                `📖 *Exemples:*\n` +
                `• ${handler.config.PREFIX}weather Paris\n` +
                `• ${handler.config.PREFIX}weather New York\n` +
                `• ${handler.config.PREFIX}weather Douala\n` +
                `• ${handler.config.PREFIX}weather Tokyo`
            );
        }

        const city = args.join(' ');

        try {
            await handler.react(from, msgInfo.msg.key, '🌤️');

            // Message de recherche
            await handler.reply(from, `🌤️ *Recherche météo en cours...*\n\n📍 Ville: "${city}"`);

            // API Key OpenWeatherMap (gratuite avec 60 calls/minute)
            const apiKey = handler.config.WEATHER_API_KEY || 'YOUR_OPENWEATHER_API_KEY';

            if (!apiKey || apiKey === 'YOUR_OPENWEATHER_API_KEY') {
                return await handler.reply(from,
                    `❌ *API Météo non configurée*\n\n` +
                    `⚙️ L'administrateur doit configurer une clé API OpenWeatherMap\n\n` +
                    `💡 *Pour obtenir une clé gratuite:*\n` +
                    `1. Visitez: https://openweathermap.org/api\n` +
                    `2. Créez un compte gratuit\n` +
                    `3. Générez une clé API\n` +
                    `4. Configurez WEATHER_API_KEY dans les paramètres`
                );
            }

            // API météo actuelle
            const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`;

            // API prévisions 5 jours
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr&cnt=8`;

            const [currentResponse, forecastResponse] = await Promise.all([
                axios.get(currentWeatherUrl, { timeout: 10000 }),
                axios.get(forecastUrl, { timeout: 10000 })
            ]);

            const current = currentResponse.data;
            const forecast = forecastResponse.data;

            // Données actuelles
            const temperature = Math.round(current.main.temp);
            const feelsLike = Math.round(current.main.feels_like);
            const humidity = current.main.humidity;
            const pressure = current.main.pressure;
            const visibility = current.visibility ? Math.round(current.visibility / 1000) : 'N/A';
            const windSpeed = Math.round(current.wind.speed * 3.6); // Conversion m/s vers km/h
            const windDeg = current.wind.deg;
            const cloudiness = current.clouds.all;
            const weatherDesc = current.weather[0].description;
            const weatherIcon = this.getWeatherEmoji(current.weather[0].id, current.weather[0].icon);

            // Lever/coucher du soleil
            const sunrise = moment.unix(current.sys.sunrise).tz(this.getTimezone(current.coord.lat, current.coord.lon)).format('HH:mm');
            const sunset = moment.unix(current.sys.sunset).tz(this.getTimezone(current.coord.lat, current.coord.lon)).format('HH:mm');

            // Direction du vent
            const windDirection = this.getWindDirection(windDeg);

            // Qualité de l'air (estimation basée sur la visibilité et l'humidité)
            const airQuality = this.getAirQuality(visibility, humidity);

            let weatherText = `╭──「 🌤️ *MÉTÉO ACTUELLE* 」\n`;
            weatherText += `│\n`;
            weatherText += `│ 📍 *Ville:* ${current.name}, ${current.sys.country}\n`;
            weatherText += `│ 🌍 *Coordonnées:* ${current.coord.lat}°, ${current.coord.lon}°\n`;
            weatherText += `│ ⏰ *Heure locale:* ${moment().tz(this.getTimezone(current.coord.lat, current.coord.lon)).format('HH:mm DD/MM/YYYY')}\n`;
            weatherText += `│\n`;
            weatherText += `╰───────────────𖠁\n\n`;

            weatherText += `╭──「 🌡️ *TEMPÉRATURES* 」\n`;
            weatherText += `│\n`;
            weatherText += `│ ${weatherIcon} *Temps:* ${weatherDesc}\n`;
            weatherText += `│ 🌡️ *Température:* ${temperature}°C\n`;
            weatherText += `│ 🤏 *Ressenti:* ${feelsLike}°C\n`;
            weatherText += `│ 📈 *Max aujourd'hui:* ${Math.round(current.main.temp_max)}°C\n`;
            weatherText += `│ 📉 *Min aujourd'hui:* ${Math.round(current.main.temp_min)}°C\n`;
            weatherText += `│\n`;
            weatherText += `╰───────────────𖠁\n\n`;

            weatherText += `╭──「 💨 *CONDITIONS* 」\n`;
            weatherText += `│\n`;
            weatherText += `│ 💧 *Humidité:* ${humidity}%\n`;
            weatherText += `│ 📊 *Pression:* ${pressure} hPa\n`;
            weatherText += `│ 👁️ *Visibilité:* ${visibility} km\n`;
            weatherText += `│ ☁️ *Couverture nuageuse:* ${cloudiness}%\n`;
            weatherText += `│ 💨 *Vent:* ${windSpeed} km/h ${windDirection}\n`;
            weatherText += `│ 🌬️ *Qualité de l'air:* ${airQuality}\n`;
            weatherText += `│\n`;
            weatherText += `╰────────────────𖠁\n\n`;

            weatherText += `╭──「 🌅 *SOLEIL* 」\n`;
            weatherText += `│\n`;
            weatherText += `│ 🌅 *Lever du soleil:* ${sunrise}\n`;
            weatherText += `│ 🌇 *Coucher du soleil:* ${sunset}\n`;
            weatherText += `│ ☀️ *Durée du jour:* ${this.getDayDuration(current.sys.sunrise, current.sys.sunset)}\n`;
            weatherText += `│\n`;
            weatherText += `╰──────────────𖠁\n\n`;

            // Prévisions sur 24h (3 prochaines tranches de 3h)
            if (forecast.list && forecast.list.length > 0) {
                weatherText += `╭──「 📅 *PRÉVISIONS 24H* 」\n`;
                weatherText += `│\n`;

                for (let i = 0; i < Math.min(3, forecast.list.length); i++) {
                    const item = forecast.list[i];
                    const time = moment.unix(item.dt).format('HH:mm');
                    const temp = Math.round(item.main.temp);
                    const desc = item.weather[0].description;
                    const emoji = this.getWeatherEmoji(item.weather[0].id, item.weather[0].icon);
                    const rain = item.rain?.['3h'] || 0;

                    weatherText += `│ ${emoji} *${time}:* ${temp}°C - ${desc}\n`;
                    if (rain > 0) {
                        weatherText += `│   🌧️ Pluie: ${rain}mm\n`;
                    }
                    weatherText += `│\n`;
                }

                weatherText += `╰────────────────𖠁\n\n`;
            }

            // Conseils météo
            const advice = this.getWeatherAdvice(temperature, current.weather[0].id, windSpeed, humidity);
            if (advice) {
                weatherText += `╭──「 💡 *CONSEILS* 」\n`;
                weatherText += `│\n`;
                weatherText += `│ ${advice}\n`;
                weatherText += `│\n`;
                weatherText += `╰────────────────𖠁\n\n`;
            }

            weatherText += `────────────────────\n`;
            weatherText += `📱 *Source:* OpenWeatherMap\n`;
            weatherText += `🔄 *Dernière mise à jour:* ${moment.unix(current.dt).format('HH:mm')}\n`;
            weatherText += `💡 *Utilisez ${handler.config.PREFIX}weather <autre ville> pour une nouvelle recherche*\n`;
            weatherText += `────────────────────\n`;
            weatherText += `${handler.config.BOT_FOOTER}`;

            // Envoyer avec une image météo
            const weatherImageUrl = this.getWeatherImageUrl(current.weather[0].icon);

            await socket.sendMessage(from, {
                image: { url: weatherImageUrl },
                caption: weatherText,
                contextInfo: {
                    externalAdReply: {
                        title: `🌤️ Météo de ${current.name}`,
                        body: `${temperature}°C • ${weatherDesc}`,
                        mediaType: 1,
                        sourceUrl: `https://openweathermap.org/city/${current.id}`,
                        thumbnailUrl: weatherImageUrl,
                        renderLargerThumbnail: true
                    }
                }
            });

            await handler.react(from, msgInfo.msg.key, '✅');

            // Logger la recherche météo
            if (global.logger) {
                await global.logger.info('Weather search performed', {
                    user: msgInfo.sender,
                    city: current.name,
                    country: current.sys.country,
                    temperature,
                    weather: weatherDesc
                });
            }

        } catch (error) {
            console.error('Erreur dans la commande weather:', error);
            await handler.react(from, msgInfo.msg.key, '❌');

            let errorMessage = '❌ *Erreur lors de la récupération de la météo*\n\n';

            if (error.response?.status === 404) {
                errorMessage += `🔍 *Ville non trouvée*\n` +
                              `La ville "${city}" n'existe pas ou l'orthographe est incorrecte.\n\n` +
                              `💡 *Suggestions:*\n` +
                              `• Vérifiez l'orthographe\n` +
                              `• Utilisez le nom en anglais\n` +
                              `• Ajoutez le pays (ex: Paris, FR)\n` +
                              `• Essayez une ville proche`;
            } else if (error.response?.status === 401) {
                errorMessage += '🔑 *Clé API invalide*\n' +
                              'La clé API météo n\'est pas valide ou a expiré.\n' +
                              'Contactez l\'administrateur du bot.';
            } else if (error.response?.status === 429) {
                errorMessage += '⏱️ *Limite de requêtes atteinte*\n' +
                              'Trop de demandes météo récemment.\n' +
                              'Réessayez dans quelques minutes.';
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                errorMessage += '🌐 *Problème de connexion*\n' +
                              'Impossible d\'accéder au service météo.\n' +
                              'Vérifiez votre connexion internet.';
            } else if (error.code === 'ECONNABORTED') {
                errorMessage += '⏰ *Timeout de la requête*\n' +
                              'La requête météo a pris trop de temps.\n' +
                              'Réessayez dans quelques secondes.';
            } else {
                errorMessage += `📝 *Détails:* ${error.message}\n\n` +
                              `💡 *Suggestions:*\n` +
                              `• Réessayez dans quelques secondes\n` +
                              `• Vérifiez l'orthographe de la ville\n` +
                              `• Contactez l'administrateur si le problème persiste`;
            }

            await handler.reply(from, errorMessage);

            // Logger l'erreur
            if (global.logger) {
                await global.logger.error('Weather search error', {
                    user: msgInfo.sender,
                    city,
                    error: error.message,
                    code: error.code,
                    status: error.response?.status
                });
            }
        }
    },

    // Méthodes helper
    getWeatherEmoji(weatherId, icon) {
        const weatherEmojis = {
            // Thunderstorm
            200: '⛈️', 201: '⛈️', 202: '⛈️', 210: '🌩️', 211: '🌩️', 212: '🌩️', 221: '🌩️', 230: '⛈️', 231: '⛈️', 232: '⛈️',
            // Drizzle
            300: '🌦️', 301: '🌦️', 302: '🌧️', 310: '🌦️', 311: '🌧️', 312: '🌧️', 313: '🌧️', 314: '🌧️', 321: '🌧️',
            // Rain
            500: '🌧️', 501: '🌧️', 502: '🌧️', 503: '🌧️', 504: '🌧️', 511: '🌨️', 520: '🌦️', 521: '🌧️', 522: '🌧️', 531: '🌧️',
            // Snow
            600: '🌨️', 601: '❄️', 602: '❄️', 611: '🌨️', 612: '🌨️', 613: '🌨️', 615: '🌨️', 616: '🌨️', 620: '🌨️', 621: '❄️', 622: '❄️',
            // Atmosphere
            701: '🌫️', 711: '🌫️', 721: '🌫️', 731: '💨', 741: '🌫️', 751: '💨', 761: '💨', 762: '🌋', 771: '💨', 781: '🌪️',
            // Clear
            800: icon?.includes('n') ? '🌙' : '☀️',
            // Clouds
            801: icon?.includes('n') ? '☁️' : '⛅', 802: '☁️', 803: '☁️', 804: '☁️'
        };

        return weatherEmojis[weatherId] || '🌤️';
    },

    getWindDirection(degrees) {
        const directions = [
            'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
            'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'
        ];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    },

    getAirQuality(visibility, humidity) {
        if (visibility >= 10) return '🟢 Excellente';
        if (visibility >= 6) return '🟡 Bonne';
        if (visibility >= 3) return '🟠 Modérée';
        if (visibility >= 1) return '🔴 Mauvaise';
        return '🟣 Très mauvaise';
    },

    getDayDuration(sunrise, sunset) {
        const duration = sunset - sunrise;
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        return `${hours}h ${minutes}m`;
    },

    getTimezone(lat, lon) {
        // Approximation basique, en réalité utiliser une API de timezone
        if (lon >= -7.5 && lon < 7.5) return 'Europe/Paris';
        if (lon >= 7.5 && lon < 22.5) return 'Europe/Berlin';
        if (lon >= 22.5 && lon < 37.5) return 'Europe/Moscow';
        // Ajouter plus de zones selon les besoins
        return 'UTC';
    },

    getWeatherImageUrl(icon) {
        return `https://openweathermap.org/img/wn/${icon}@4x.png`;
    },

    getWeatherAdvice(temp, weatherId, windSpeed, humidity) {
        let advice = '';

        // Conseils basés sur la température
        if (temp < 0) {
            advice += '🧥 Habillez-vous chaudement, risque de gel!\n';
        } else if (temp < 10) {
            advice += '🧤 Prévoyez des vêtements chauds.\n';
        } else if (temp > 30) {
            advice += '☀️ Restez hydraté et évitez le soleil aux heures chaudes.\n';
        } else if (temp > 25) {
            advice += '👕 Vêtements légers recommandés.\n';
        }

        // Conseils basés sur les conditions météo
        if (weatherId >= 200 && weatherId < 300) {
            advice += '⛈️ Évitez les activités extérieures, orages dangereux!\n';
        } else if (weatherId >= 300 && weatherId < 600) {
            advice += '☂️ N\'oubliez pas votre parapluie!\n';
        } else if (weatherId >= 600 && weatherId < 700) {
            advice += '❄️ Attention aux routes glissantes!\n';
        } else if (weatherId >= 700 && weatherId < 800) {
            advice += '🌫️ Visibilité réduite, conduisez prudemment.\n';
        }

        // Conseils basés sur le vent
        if (windSpeed > 50) {
            advice += '💨 Vent très fort, évitez les sorties non essentielles!\n';
        } else if (windSpeed > 30) {
            advice += '🍃 Vent modéré, attention aux objets légers.\n';
        }

        // Conseils basés sur l'humidité
        if (humidity > 80) {
            advice += '💧 Humidité élevée, sensation d\'étouffement possible.\n';
        } else if (humidity < 30) {
            advice += '🏜️ Air sec, pensez à vous hydrater.\n';
        }

        return advice.trim();
    }
};
