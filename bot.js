const Discord = require('discord.js');
require('discord-reply');
const client = new Discord.Client();
const https = require('https');
const express = require('express');
const fs = require('fs');

const app = express();
const port = 3000;

app.get('/', async (_, res) => {
    res.sendFile('wakeup.html', {root: __dirname});
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
})

require('dotenv').config()

client.once('ready', () => {
    console.log("Ready")
})

let wordCompletionTracker = new Map();

let cooldown = new Map();

const embedColors = ['#96ff26', '#ff2696', '#7d26ff']

client.on('message', msg => {
    if (msg.channel.type === 'dm') return;

    if (wordCompletionTracker.has(`${msg.member.id} ${msg.channel.id}`)) {
        let guess =  wordCompletionTracker.get(`${msg.member.id} ${msg.channel.id}`);
        wordCompletionGuess(msg, guess.word, guess.timer);
        wordCompletionTracker.delete(`${msg.member.id} ${msg.channel.id}`);
        return;
    }

    if (!msg.content.startsWith('.')) return;

    msg.content = msg.content.substr(1).toLowerCase().split(' ').filter(c => c.length > 0).join(' ');

    if (msg.content == 'hi') {
        msg.lineReply('Hello :)');
    } else if (msg.content.startsWith('guess')) {
        guessCommand(msg, 10);
    } else if (msg.content.startsWith('guess-but-harder') || msg.content.startsWith('gbh')) {
        guessCommand(msg, 100);
    } else if (msg.content == 'help') {
        helpCommand(msg);
    } else if (msg.content == 'word') {
        wordCompletionCommand(msg);
        msg.member.id
    }
     else {
        const embed = new Discord.MessageEmbed()
            .setColor(embedColors[1])
            .setTitle("WOAH HOL' UP")
            .setDescription("That command doesn\'t even exist. You should get some `.help` **noob**.");
        msg.lineReplyNoMention(embed);
    }

});

client.login(process.env.BOT_TOKEN)

function guessCommand(msg, range) {
    let randomNumber = Math.floor(Math.random() * range);

    let commandName = msg.content.split(' ')[0];

    if (msg.content.split(' ').filter(c => c.length > 0).length != 2 || isNaN(parseInt(msg.content.split(' ')[1]))) {
        msg.lineReplyNoMention(`Format: \`.${commandName} <a number(0 - ${range})>\``);
        return;
    }

    let guessStr = msg.content.split(' ')[1];

    if (guessStr.startsWith('+') || guessStr.startsWith('-')) {
        guessStr = guessStr.substr(1);
    }

    let title = '';
    let description = '';

    for (const c of guessStr.split('')) {
        if (isNaN(parseInt(c))) {
            title = "Something's wrong, I can feel it..."
            description = `Maybe \`${guessStr}\` is not a number 🤔`

            const embed = new Discord.MessageEmbed()
            .setColor(embedColors[1])
            .setTitle(title)
            .setDescription(description);

            msg.lineReplyNoMention(embed);
            return;
        }
    };

    let guess = parseInt(msg.content.split(' ')[1]);

    if (guess < 0 || guess > range) {
        title = 'Noob'
        if (guess < 0) {
            description = 'Imagine guessing a number less than 0, couldn\'t be me';
        } else {
            description  = `Imagine guessing a number higher than ${range}, smh`
        }

        const embed = new Discord.MessageEmbed()
            .setColor(embedColors[1])
            .setTitle(title)
            .setDescription(description);

        msg.lineReplyNoMention(embed);
        return;
    }

    let won = false;
    
    if (guess !== randomNumber) {
        title = "You suck lmao";
        description = `Your guess was ${guess}, the number was ${randomNumber}.`;
        if (guess == 42 || guess == 69) {
            description += '\nNice number tho.'
        }
    } else {
        title = "Wow very pro"
        description = `You guessed it correct :O`
        won = true;
    }

    const embed = new Discord.MessageEmbed()
        .setColor(won? embedColors[0] : embedColors[1])
        .setTitle(title)
        .setDescription(description);

    if (won && Math.random() > 0.2) {
        embed.setFooter('Noice');
    }

    msg.lineReplyNoMention(embed);
}

function helpCommand(msg) {
    const helpEmbed = new Discord.MessageEmbed()
        .setColor(embedColors[2])
        .setTitle('Okay then')
        .addField('`hi`', 'Idk')
        .addField('`guess`', 'Guess a number from 0 to 10 **(or you can\'t do that?)**')
        .addField('`guess-but-harder`', 'Don\'t worry about this command, you probably can\'t guess a number from 0 to 100 correct')
        .addField('`gbh`', 'Alias for guess-but-harder bc it\'s too long lol')
        .addField('`word`', 'Guess the word **(or you can\'t do that?)**')
        .setFooter('Prefix: \'.\'(a literal full stop)');

    msg.lineReplyNoMention(helpEmbed);
}

async function wordCompletionCommand(msg) {

    if (cooldown.has(msg.member.id)) {
        if (new Date().getTime() - cooldown.get(msg.member.id)  <= 5000) {
            const embed = new Discord.MessageEmbed()
                .setColor(embedColors[1])
                .setTitle("Woah, that's way too fast!")
                .setDescription("You can't just spam Wordnik API like that...");
            msg.lineReplyNoMention(embed);
            return;
        } else {
            cooldown.delete(msg.member.id);
        }
    }

    // http://api.wordnik.com:80/v4/words.json/randomWords?hasDictionaryDef=true&minCorpusCount=0&minLength=3&maxLength=15&limit=1
    const options = {
        hostname: 'api.wordnik.com',
        port: 443,
        path: `/v4/words.json/randomWord?hasDictionaryDef=true&excludePartOfSpeech=family-name%2C%20given-name&minCorpusCount=0&minLength=5&maxLength=15&api_key=${process.env.WORDNIK_API_KEY}`,
        method: 'GET'
    }

    let msgNew = await msg.lineReplyNoMention(
        new Discord.MessageEmbed()
            .setTitle("Loading 🟡🟠🟠")
            .setDescription("This is gonna take a while bc my internet sux")
    );

    let loadingAnimation = {
        loader: [1, 0, 0],
        loader_idx: 0,
        interval: null,
    }

    loadingAnimation.interval = setInterval(function() {
        loadingAnimation.loader_idx++;
        if (loadingAnimation.loader_idx >= loadingAnimation.loader.length) loadingAnimation.loader_idx = 0;

        loadingAnimation.loader = [0, 0, 0];
        loadingAnimation.loader[loadingAnimation.loader_idx] = 1;

        msgNew.edit(new Discord.MessageEmbed()
            .setTitle(`Loading ${loadingAnimation.loader[0]? '🟡' : '🟠'}${loadingAnimation.loader[1]? '🟡' : '🟠'}${loadingAnimation.loader[2]? '🟡' : '🟠'}`)
            .setDescription("Hold on...")
        )
    }, 500);

    cooldown.set(msg.member.id, new Date().getTime());

    const req = https.request(options, res => {
        res.on('data', d => {
            let json = JSON.parse(d)
            if (!json) return;
            wordCompletionGame(msg, json.word, msgNew, loadingAnimation.interval);
        });
    })

    req.on('error', e => console.error(e));
    req.end();
}

async function wordCompletionGame(msg, word, respMsg, loadingInterval) {
    clearInterval(loadingInterval);

    let blanked_word = removeLetters(word).replace('_', '\\_');

    respMsg.edit(new Discord.MessageEmbed()
        .setColor(embedColors[2])
        .setTitle("Okay, now guess...")
        .setDescription(`${blanked_word}`)
    )

    let timer = setTimeout(function() {
        
        const embed = new Discord.MessageEmbed()
            .setColor(embedColors[1])
            .setTitle("Time's up!")
            .setDescription(`The word was ${word}`)
            .setFooter("Imagine losing lmao");
        msg.lineReplyNoMention(embed);
        wordCompletionTracker.delete(`${msg.member.id} ${msg.channel.id}`);
    }, 15000);

    wordCompletionTracker.set(`${msg.member.id} ${msg.channel.id}`, {
        word: word,
        timer: timer,
    });
}

function wordCompletionGuess(msg, word, timer) {
    clearTimeout(timer);
    let responseMsg;
    if (msg.content.toLowerCase() == word.toLowerCase()) {
        responseMsg = new Discord.MessageEmbed()
            .setColor(embedColors[0])
            .setTitle("You did it!")
            .setDescription("Your guess was correct.")
        
        if (Math.random() > 0.2) responseMsg.setFooter("Wow much pro");
    } else {
        responseMsg = new Discord.MessageEmbed()
            .setColor(embedColors[1])
            .setTitle("Nope, thats wrong")
            .setDescription(`The word was ${word}.`)
            .setFooter("YOU LOST LMFAO")
    }
    msg.lineReplyNoMention(responseMsg);
}

function removeLetters(word) {
    let max_blank_letters = Math.floor( Math.random() * (word.length * (2 / 4)) );
    if (max_blank_letters == 0) max_blank_letters = 1;

    let rand_num_range = word.length - 1;

    let blanked_word = word;

    for (let i = 0; i < max_blank_letters; i++) {
        let idx = Math.floor(Math.random() * rand_num_range);
        if (!blanked_word[idx].match(/[a-zA-Z]/)) continue;

        blanked_word = blanked_word.replaceAt(idx, '_');
    }

    return blanked_word;
}

String.prototype.replaceAt = function(index, replacement) {
    if (index >= this.length) {
        return this.valueOf();
    }
 
    var chars = this.split('');
    chars[index] = replacement;
    return chars.join('');
}
