// Description:
//    Create scoreboards to keep track of scores for, you know, whatever! Can be differently styled scoreboards:
//       * points  - just keep track of points!
//       * winloss - the scoreboard keeps tracks of wins and losses with no further validation.
//       * zerosum - similar to winloss except the wins must equal the losses across all players.
//       * elo     - zerosum, records draws, and also calculates Elo!
//
// Commands:
//   hubot scoreboard create {name} [winloss|zerosum|points] - create a new scoreboard with the given name and game style.
//   hubot scoreboard delete {scoreboard} - remove a scoreboard. Only the scoreboard's creator can do this.
//   hubot scoreboard {name} - view a scoreboard.
//   hubot addplayer {scoreboard} {player} - add a player to the scoreboard.
//   hubot changeplayer {scoreboard} {oldname} {newname} - update a player's name
//   hubot removeplayer {scoreboard} {player} - remove a player from the scoreboard.
//   hubot markscore {scoreboard} win {user} [loss {user}] - mark a winner/loser!
//       The second user is optional if the scoreboard is not zerosum.
//   hubot markscore {scoreboard} +N {user} [-N {user}] - mark a score increase or decrease!
//       The second user is optional if the scoreboard is not zerosum.
//   !mark {scoreboard} win {user} [loss {user}] - shorthand for the above commands
//
// Config
//
// Author:
//   Perry Goy https://github.com/perrygoy


const ScoreKeeperMod = require('./scorekeeper');
const ELO_CONSTANT = process.env.HUBOT_SCOREBOARD_BUILDER_ELO_CONSTANT || 32;
const SHOW_NUM = process.env.HUBOT_SCOREBOARD_BUILDER_SHOW_NUM || 5;
const COL_WIDTH = 10;


module.exports = function(robot) {
    const Bookie = new ScoreKeeperMod(robot);

    this.getUsername = response => {
        const user = response.message.user;
    if (user.profile) {
            return user.profile.display_name || user.name;
        } else {
            return user.name;
        }
    };

    this.createScoreboard = (scoreboardName, type, user) => {
        return Bookie.createScoreboard(scoreboardName, type, user);
    };

    this.deleteScoreboard = (scoreboardName, user) => {
        return Bookie.deleteScoreboard(scoreboardName, user);
    };

    this.getScoreboard = scoreboardName => {
        const scoreboard = Bookie.getScoreboard(scoreboardName);
        return scoreboard;
    };

    this.getOwner = scoreboardName => {
        return Bookie.getOwner(scoreboardName);
    };

    this.isPlayerOnScoreboard = (scoreboardName, playerName) => {
        const scoreboard = Bookie.getScoreboard(scoreboardName);
        return typeof scoreboard.players[playerName] !== 'undefined';
    };

    this.addPlayer = (scoreboardName, player) => {
        return Bookie.addPlayer(scoreboardName, player);
    };

    this.changePlayer = (scoreboardName, oldName, newName) => {
        return Bookie.changePlayer(scoreboardName, oldName, newName);
    }

    this.removePlayer = (scoreboardName, player) => {
        return Bookie.removePlayer(scoreboardName, player);
    };

     /**
    * Takes a score-ish and turns it into a number.
    *
    * @param {string} score the score to turn into a number: win, loss, or +/- N
    * @return int
    */
    this.numberifyScore = score => {
        let numberedScore = 0;
        if (!score) {
            numberedScore = 0;
        } else if (['win', 'won', 'winner'].includes(score)) {
            numberedScore = 1;
        } else if (['loss', 'lose', 'lost', 'loser'].includes(score)) {
            numberedScore = -1;
        } else if (score === 'draw') {
            numberedScore = .5;
        } else {
            numberedScore = Number(score);
        }
        return numberedScore;
    };

    this.isValidScoreString = (scoreboard, scorePieces) => {
        if (scorePieces.length == 1) {
            return !(isNaN(this.numberifyScore(scorePieces[0])) || ['elo', 'zerosum'].includes(scoreboard.type));
        } else if (scorePieces.length % 2 != 0) {
            return false;
        }
        const scores = scorePieces.filter((_, index) => index % 2 == 0).map(this.numberifyScore);
        if (scores.includes(NaN)) {
            return false;
        }
        const scoreTotal = scores.reduce((tot, num) => tot + num)
        if ( scoreTotal != 0) {
            return !['elo', 'zerosum'].includes(scoreboard.type);
        }
        return true;
    };

    this.getScoreData = (scoreboardType, score, scoreData = {points: 0, wins: 0, losses: 0, draws: 0}) => {
        if (scoreboardType == 'points') {
            scoreData.points += score;
        } else {
            if (score == .5) {
                scoreData.draws = 1;
            } else if (score >= 0) {
                scoreData.wins = score;
            } else {
                scoreData.losses = score * -1;
            }
        }
        return scoreData;
    };

    this.bundleScoreData = (scoreboard, scorePieces) => {
        let scoreData = {};
        if (scorePieces.length == 1) {
            const players = Object.keys(scoreboard.players);
            for (const player of players) {
                scoreData[player] = this.getScoreData(scoreboard.type, this.numberifyScore(scorePieces[0]));
            }
        } else {
            for (let i = 0; i < scorePieces.length - 1; i += 2) {
                const score = this.numberifyScore(scorePieces[i]);
                const player = scorePieces[i+1];
                scoreData[player] = this.getScoreData(scoreboard.type, score, scoreData[player]);
            }
        }
        return scoreData;
    };

    this.calculateEloChange = (p1elo, p2elo, score) => {
        const expected = Math.pow(10, p1elo/400) / (Math.pow(10, p1elo/400) + Math.pow(10, p2elo/400));
        let eloChange = Math.round(ELO_CONSTANT * (score - expected));
        if (eloChange == 0){
            if ((score - expected) < 0) {
                eloChange = -1;
            } else {
                eloChange = 1;
            }
        }
        return eloChange;
    };

    this.markScores = (scoreboardName, scoreData) => {
        for (const playerName of Object.keys(scoreData)) {
            let scores = scoreData[playerName];
            Bookie.adjustScores(scoreboardName, playerName, scores.wins, scores.losses, scores.draws, scores.points, scores.elo);
        }
    };

     /**
    * Takes a list and returns a string all nice. For example, [1, 2, 3] returns "1, 2, and 3".
    *
    * @param {array} items the list of items to listify
    * @return string
    */
    this.getNiceList = (items) => {
        if (items.length == 1) {
            return items[0];
        }
        if (items.length == 2) {
            return `${items[0]} and ${items[1]}`;
        } else {
            return `${items.slice(0, -1).join(', ')}, and ${items.slice(-1)[0]}`;
        }
    };

    var getNameColWidth = collection => {
        const longestPlayer = collection.reduce((i1, i2) => (i1.name.length > i2.name.length ? i1 : i2));
        const rankLength = Math.floor(Math.log10(collection.length)) + 2;
        return Math.max(COL_WIDTH, longestPlayer.name.length + rankLength + 1);
    };

    // response builders

    /**
    * Takes in a list of possible responses and returns a random one
    * @param {list} responseList the list of responses
    * @return list item
    */
    this.getRandomResponse = (responseList) => {
        const i = Math.floor(Math.random() * responseList.length);
        return responseList[i];
    };

    this.getScoreboardListMessage = () => {
        const boardList = Bookie.getScoreboards();
        const boardListString = this.stringifyBoardList(boardList);
        const boardListResponses = [
            `You want all the books? I'll show yas all the books: \n${boardListString}`
        ];
        return this.getRandomResponse(boardListResponses);
    };

    this.getShowScoreboardMessage = (scoreboardName, full = false) => {
        const scoreboardResponses = [
            'Here\'s the play, see?',
            'The gravy train\'s ridin\' all over town on this one.',
            'You got it, boss:',
            'Better keep this outta sight of the bulls, know what I\'m sayin\'?',
        ];
        return `${this.getRandomResponse(scoreboardResponses)}\n${this.stringifyScoreboard(scoreboardName, full)}`;
    };

    this.getShowPlayerScoreMessage = (scoreboardName, playerName) => {
        const playerResponses = [
            'All right, Mack, but you didn\'t hear it from me:',
            'What\'s it to you? You a private eye? Nah, just pullin\' ya leg:',
            'Here\'s the skinny:',
            `${playerName}, eh? Yeah, I think I knows 'em:`,
        ];
        return `${this.getRandomResponse(playerResponses)}\n${this.stringifyPlayerScore(scoreboardName, playerName)}`
    };

    this.getAddPlayerSuccessMessage = (addedPlayers, scoreboardName) => {
        const addPlayersSuccessResponses = [
            `OK, I've penciled in ${addedPlayers} on ${scoreboardName}.`,
            `OK pal, I got ${addedPlayers}. We're all set here.`,
            `Johnny Two-fingers told me this fella'd take us all the way to the bank. ${addedPlayers} have been added on ${scoreboardName}.`,
            `Why do _you_ think his name is Johnny Two-fingers?`,
        ];
        return this.getRandomResponse(addPlayersSuccessResponses);
    };

    this.getNoAddedPlayersMessage = () => {
        const addPlayersFailResponses = [
            `All'a them bubs's already on the list, pal.`,
            `What, you tryin' to double up or somethin'? All's thems already on the list. Now get outta here.`,
        ];
        return this.getRandomResponse(addPlayersFailResponses);
    };

    this.getChangedPlayerMessage = (oldName, newName) => {
        const changeResponses = [
            `Between you an' me, this chump feels like a ${newName}. Got it all squared away for ya, pal.`,
            `${oldName}, ${newName}, all's fine by me s'long as ya all pay yer dues.`,
            `All right boss, ${oldName} is kaput. We ain't never heard 'a them. But if y'lookin' fer ${newName}? Yeah, I knows 'em.`,
        ];
        return this.getRandomResponse(changeResponses);

    this.getNoRemovedPlayersMessage = () => {
        const removePlayersFailResponses = [
            `I don't know any o' them chumps.`,
            `Nothin' here but ghosts, pal.`,
        ];
        return this.getRandomResponse(removePlayersFailResponses);
    };

    this.getRemovePlayerMessage = players => {
        const removeResponses = [
            `Alright, Johnny. I don't know what business you two had, but I ain't askin' neither. ${players} is gone.`,
            `${players} is sleepin' with the fishes now, and that's all there is to it.`,
            `You want I should strike ${players} from the record, eh? Alright, you got it.`,
            `Alright buddy. You don't gotta worry about ${players} no more.`,
        ];
        return this.getRandomResponse(removeResponses);
    };

    this.getMissingPlayerMessage = (scoreboardName, playerName) => {
        const missingResponses = [
            `I don't know what kind of game you're playin' here, bud, but ${playerName} isn't marked on ${scoreboardName}.`,
            `Who you kiddin'? ${playerName} isn't marked on ${scoreboardName}.`,
            `I ain't never heard 'a no ${playerName}, bub. Yer wastin' my time.`,
        ];
        return this.getRandomResponse(missingResponses);
    };

    this.getMissingScoreboardMessage = scoreboardName => {
        const missingBoardResponses = [
            `I ain't never heard'a no ${scoreboardName}. Get away from me, kid, ya bother me.`,
        ];
        return this.getRandomResponse(missingBoardResponses);
    };

    this.getArchivedScoreboardMessage = scoreboardName => {
        const archivedBoardResponses = [
            `Look, I can track ${scoreboardName} down for yas, but y'can't change it no more.`,
            `All I got is the last time anyone's seen ${scoreboardName}. It's under wraps now.`,
            `Ain't no one seen ${scoreboardName} in years. I can describe it for yas though.`,
        ];
        return this.getRandomResponse(archivedBoardResponses);
    };

    this.getInvalidScoreStringMessage = scoreString => {
        const invalidScoreStringResponses = [
            `Kid, you may as well be speakin' gibberish. "${scoreString}" don't make a lick a sense to me.`,
            `You wanna try again there, boss? I can't make heads er tails a "${scoreString}."`,
        ];
        return this.getRandomResponse(invalidScoreStringResponses);
    };

    // scoreboard functions

    this.sortPlayers = (players, scoreboardType) => {
        if (scoreboardType === 'elo') {
            return players.sort((p1, p2) => p2.elo - p1.elo);
        }
        if (scoreboardType === 'points') {
            return players.sort((p1, p2) => p2.points - p1.points);
        }
        // more losses puts you lower
        players.sort((p1, p2) => p1.losses - p2.losses);
        // more wins puts you higher
        return players.sort((p1, p2) => p2.wins - p1.wins)
    };

     /**
    * Prints the list of scoreboards all pretty-like.
    *
    * @param {array} boardList the list of scoreboard objects
    * @return string
    */
    this.stringifyBoardList = boardList => {
        const nameColumnWidth = getNameColWidth(boardList);
        const tableWidth = (nameColumnWidth + 2) + ((COL_WIDTH + 3) * 2);
        let boardListString = '```' + `.${'_'.repeat(tableWidth)}.\n| ${'Board Name'.padEnd(nameColumnWidth)} | ${'Type'.padEnd(COL_WIDTH)} | ${'Players'.padStart(COL_WIDTH)} |\n`;
        boardListString += `|${'='.repeat(tableWidth)}|\n`;
        for (const scoreboard of boardList) {
            const numPlayers = Object.keys(scoreboard.players).length.toString();
            boardListString += `| ${scoreboard.name.padEnd(nameColumnWidth)} | ${scoreboard.type.padEnd(COL_WIDTH)} | ${numPlayers.padStart(COL_WIDTH)} |\n`;
        }
        boardListString += `º${'-'.repeat(tableWidth)}º` + '```';
        return boardListString;
    };

    // scoreboard printers

    const POINTS_COLS = [{header: 'Points', getter: player => player.points.toString()}];
    const WINLOSS_COLS = [
        {header: 'Wins', getter: player => player.wins.toString()},
        {header: 'Losses', getter: player => player.losses.toString()},
        {header: 'Win Ratio', getter: player => (player.wins / (player.wins + player.losses)).toFixed(3).replace('NaN', 'N/A')}
    ];
    const ZEROSUM_COLS = [
        {header: 'Wins', getter: player => player.wins.toString()},
        {header: 'Losses', getter: player => player.losses.toString()},
        {header: 'Win Ratio', getter: player => (player.wins / (player.wins + player.losses)).toFixed(3).replace('NaN', 'N/A')}
    ];
    const ELO_COLS = [
        {header: 'Wins', getter: player => player.wins.toString()},
        {header: 'Losses', getter: player => player.losses.toString()},
        {header: 'Draws', getter: player => player.draws.toString()},
        {header: 'Elo', getter: player => player.elo.toString()},
    ];

    const SCOREBOARD_COLUMNS = {
        points: POINTS_COLS,
        winloss: WINLOSS_COLS,
        zerosum: ZEROSUM_COLS,
        elo: ELO_COLS,
    };

    var getBoardWidth = (scoreboard, playerColWidth) => {
        return (playerColWidth + 2) + ((COL_WIDTH + 3) * SCOREBOARD_COLUMNS[scoreboard.type].length)
    }

    var getBoardTab = (scoreboard, boardWidth) => {
        let boardTab = '```' + `.${'_'.repeat(scoreboard.name.length + 2)}.\n| ${scoreboard.name} : ${scoreboard.type}`;
        if (scoreboard.archived) {
            boardTab += ' (archived)';
        }
        boardTab += `\n+${'-'.repeat(boardWidth)}.\n`;
        return boardTab;
    }

    var getHeaderRow = (scoreboardType, playerColWidth) => {
        const headerRow = SCOREBOARD_COLUMNS[scoreboardType].map(col => col.header.padStart(COL_WIDTH)).join(' | ');
        return `| ${'Player'.padEnd(playerColWidth)} | ${headerRow} |\n`;
    };

    var getPlayerRow = (scoreboardType, playerColWidth, rank, player) => {
        const rankedName = `${rank + 1}. ${player.name}`;
        const playerData = SCOREBOARD_COLUMNS[scoreboardType].map(col => col.getter(player).padStart(COL_WIDTH)).join(' | ')
        return `| ${rankedName.padEnd(playerColWidth)} | ${playerData} |\n`;
    };

     /**
    * Prints the scoreboard all pretty-like.
    *
    * @param {string} scoreboardName the name of the scoreboard to turn into a string
    * @return string
    */
    this.stringifyScoreboard = (scoreboardName, full = false, namesModified = []) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        const players = Object.entries(scoreboard.players).map(player => Object.assign({name: player[0]}, player[1]));
        let playerColWidth = getNameColWidth(players);
        const boardWidth = getBoardWidth(scoreboard, playerColWidth);

        let boardString = getBoardTab(scoreboard, boardWidth);
        boardString += getHeaderRow(scoreboard.type, playerColWidth);
        boardString += `|${'='.repeat(boardWidth)}|\n`;

        const sortedPlayers = this.sortPlayers(players, scoreboard.type);
        let showPlayers = sortedPlayers;
        if (!full) {
            showPlayers = sortedPlayers.slice(0, SHOW_NUM);
        }

        for (const [rank, player] of showPlayers.entries()) {
            boardString += getPlayerRow(scoreboard.type, playerColWidth, rank, player);
        }

        if (!full) {
            let lastRank = SHOW_NUM - 1;
            const uniqueNames = namesModified.filter((name, index) => namesModified.indexOf(name) === index);
            const modifiedPlayers = uniqueNames.map(name => sortedPlayers.find(player => player.name == name));
            const sortedModifiedPlayers = modifiedPlayers.sort(
                (p1, p2) => sortedPlayers.indexOf(p1) - sortedPlayers.indexOf(p2)
            );
            const squishedRow = `| ...${' '.repeat(boardWidth - 4)}|\n`;

            for (const player of sortedModifiedPlayers) {
                let rank = sortedPlayers.indexOf(player);
                if (rank < SHOW_NUM) {
                    continue;
                } else if (rank > lastRank + 1) {
                    boardString += squishedRow;
                }
                boardString += getPlayerRow(scoreboard.type, playerColWidth, rank, player);
                lastRank = rank;
            }
            if (lastRank < sortedPlayers.length - 1) {
                boardString += squishedRow;
            }
        }
        boardString += `º${'-'.repeat(boardWidth)}º` + '```';
        return boardString;
    };

     /**
    * Prints a single player's score all pretty-like.
    *
    * @param {string} scoreboardName the name of the scoreboard to turn into a string
    * @param {string} playerName the name of the player whose score to print
    * @return string
    */
    this.stringifyPlayerScore = (scoreboardName, playerName) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        const players = Object.entries(scoreboard.players).map(player => Object.assign({name: player[0]}, player[1]));
        const player = players.find(player => player.name == playerName);
        const sortedPlayers = this.sortPlayers(players, scoreboard.type);
        let playerColWidth = getNameColWidth([player]);
        const boardWidth = getBoardWidth(scoreboard, playerColWidth);
        const rank = sortedPlayers.indexOf(player);

        let playerScoreString = getBoardTab(scoreboard, boardWidth);
        playerScoreString += getHeaderRow(scoreboard.type, playerColWidth);
        playerScoreString += getPlayerRow(scoreboard.type, playerColWidth, rank, player);
        playerScoreString += `º${'-'.repeat(boardWidth)}º` + '```';
        return playerScoreString;
    };

    // handlers

    this.handleCreateScoreboard = (response, scoreboardName, type, user) => {
        if (this.createScoreboard(scoreboardName, type, user)) {
            response.send(`All right mac, I gotcha down. ${scoreboardName} is on the books.`);
        } else {
            response.send(`Sorry bub, I'm already keepin' scores under ${scoreboardName}. Pick another one.`);
        }
    };

    this.handleGetScoreboard = (response, scoreboardName, option) => {
        if (typeof scoreboardName === 'undefined') {
            response.send(this.getScoreboardListMessage());
            return;
        }
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        }
        if (Object.keys(scoreboard.players).length > 0) {
            if (option == 'full') {
                response.send(this.getShowScoreboardMessage(scoreboardName, true));
            } else if (typeof option === 'undefined') {
                response.send(this.getShowScoreboardMessage(scoreboardName));
            } else {
                if (!this.isPlayerOnScoreboard(scoreboardName, option)) {
                    response.send(this.getMissingPlayerMessage(scoreboardName, option));
                } else {
                    response.send(this.getShowPlayerScoreMessage(scoreboardName, option));
                }
            }
        } else {
            response.send(`Ain't much t'tell ya, mac. There are no players for ${scoreboardName}. You can add some with the addplayers command.`);
        }
    };

    this.handleArchiveScoreboard = (response, scoreboardName, user) => {
        if (this.getScoreboard(scoreboardName) === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        }
        if (this.archiveScoreboard(scoreboardName, user)) {
            response.send(`OK, I'll put ${scoreboardName} on ice for yas.`);
        } else {
            response.send(`Hey, don't get pushy with me pal. Only ${this.getOwner(scoreboardName)} can archive ${scoreboardName}.`);
        }
    };

    this.handleUnarchiveScoreboard = (response, scoreboardName, user) => {
        if (this.getScoreboard(scoreboardName) === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        }
        if (this.unarchiveScoreboard(scoreboardName, user)) {
            response.send(`OK, ${scoreboardName} is thawed out real nice.`);
        } else {
            response.send(`Only ${this.getOwner(scoreboardName)} knows the whereabouts o' ${scoreboardName}. You'll have to ask them.`);
        }
    };

    this.handleDeleteScoreboard = (response, scoreboardName, user) => {
        if (this.getScoreboard(scoreboardName) === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        }
        if (this.deleteScoreboard(scoreboardName, user)) {
            response.send(`OK, I'll pretend I ain't never seen yas.`);
        } else {
            response.send(`We got a wise guy over here. Only the scoreboard owner, ${this.getOwner(scoreboardName)}, can delete ${scoreboardName}!`);
        }
    };

    this.handleAddPlayers = (response, scoreboardName, players) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        } else if (scoreboard.archived) {
            response.send(this.getArchivedScoreboardMessage(scoreboardName));
            return;
        }
        const playerList = players.split(' ').map((player) => player[0] === '@' ? player.slice(1) : player );
        let addedPlayers = [];
        playerList.forEach((playerName) => {
            if (!this.isPlayerOnScoreboard(scoreboardName, playerName)) {
                this.addPlayer(scoreboardName, playerName);
                addedPlayers.push(playerName)
            }
        });
        if (addedPlayers.length == 2) {
            addedPlayers.push("_your mother_");
        }
        if (addedPlayers.length > 0) {
            response.send(this.getAddPlayerSuccessMessage(this.getNiceList(addedPlayers), scoreboardName));
        } else {
            response.send(this.getNoAddedPlayersMessage());
        }
    };

    this.handleChangePlayerName = (response, scoreboardName, oldName, newName) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        } else if (scoreboard.archived) {
            response.send(this.getArchivedScoreboardMessage(scoreboardName));
            return;
        }
        if (this.changePlayer(scoreboardName, oldName, newName)) {
            response.send(this.getChangedPlayerMessage(oldName, newName));
        } else {
            response.send(this.getMissingPlayerMessage(scoreboardName, oldName));
        }
    }

    this.handleRemovePlayers = (response, scoreboardName, players) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        } else if (scoreboard.archived) {
            response.send(this.getArchivedScoreboardMessage(scoreboardName));
            return;
        }
        const playerList = players.split(' ').map((player) => player[0] === '@' ? player.slice(1) : player );
        let removedPlayers = [];
        playerList.forEach((playerName) => {
            if (this.isPlayerOnScoreboard(scoreboardName, playerName)){
                this.removePlayer(scoreboardName, playerName);
                removedPlayers.push(playerName)
            }
        });
        if (removedPlayers.length > 0) {
            response.send(this.getRemovePlayerMessage(this.getNiceList(removedPlayers)));
        } else {
            response.send(this.getNoRemovedPlayersMessage());
        }
    };

    this.handleMarkScore = (response, scoreboardName, scoresString) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        } else if (scoreboard.archived) {
            response.send(this.getArchivedScoreboardMessage(scoreboardName));
            return;
        }
        const scorePieces = scoresString.split(' ');
        if (scoresString === '' || !this.isValidScoreString(scoreboard, scorePieces)) {
            let message = this.getInvalidScoreStringMessage(scoresString);
            if (['elo', 'zerosum'].includes(scoreboard.type)) {
                message += ` Remember that ${scoreboardName} is trackin' a zero-sum game.`;
            }
            response.send(message);
            return;
        }
        const players = scorePieces.filter((_, index) => index % 2 == 1);
        for (const player of players) {
            if (!this.isPlayerOnScoreboard(scoreboardName, player)) {
                response.send(this.getMissingPlayerMessage(scoreboardName, player));
                return;
            }
        }
        const scoreData = this.bundleScoreData(scoreboard, scorePieces);
        this.markScores(scoreboardName, scoreData);
        response.send(`OK pal, here's the latest standin's:\n\n${this.stringifyScoreboard(scoreboardName, false, players)}`);
    };

    // responses

    robot.respond(/scoreboard create (\w+) (points|winloss|zerosum|elo)\s*$/i, response => {
        this.handleCreateScoreboard(response, response.match[1], response.match[2], this.getUsername(response));
    });

    robot.respond(/scoreboard archive (\w+)\s*$/i, response => {
        this.handleArchiveScoreboard(response, response.match[1], this.getUsername(response));
    });

    robot.respond(/scoreboard unarchive (\w+)\s*$/i, response => {
        this.handleUnarchiveScoreboard(response, response.match[1], this.getUsername(response));
    });

    robot.respond(/scoreboard delete (\w+)\s*$/i, response => {
        this.handleDeleteScoreboard(response, response.match[1], this.getUsername(response));
    });

    robot.respond(/scoreboards? ?(\w+)? ?(\w+)?\s*$/i, response => {
        this.handleGetScoreboard(response, response.match[1], response.match[2]);
    });

    robot.hear(/^!(scoreboards?|board) ?(\w+)?$/i, response => {
        this.handleGetScoreboard(response, response.match[2]);
    });

    robot.respond(/addplayers? (\w+) ((?:@?\w+\s*)+)\s*$/i, response => {
        this.handleAddPlayers(response, response.match[1], response.match[2]);
    });

<<<<<<< HEAD
    robot.respond(/changeplayers? (\w+) (@?\w+)\s+(@?\w+)\s*$/i, response => {
        this.handleChangePlayerName(response, response.match[1], response.match[2], response.match[3]);
=======
    robot.hear(/^!addplayers? (\w+) ((?:@?\w+\s*)+)\s*$/i, response => {
        this.handleAddPlayers(response, response.match[1], response.match[2]);
>>>>>>> 53b7a314e6d6baed757e811f788882e478d9b834
    });

    robot.respond(/removeplayers? (\w+) ((?:@?\w+\s*)+)\s*$/i, response => {
        this.handleRemovePlayers(response, response.match[1], response.match[2]);
    });

    robot.hear(/!removeplayers? (\w+) ((?:@?\w+\s*)+)\s*$/i, response => {
        this.handleRemovePlayers(response, response.match[1], response.match[2]);
    });

    robot.respond(/markscore (\w+) ((?: ?([+-][\d]+|w|win|winner|won|l|loss|lose|loser|lost|draw)( @?(\w+))?)+)\s*$/i, response => {
        this.handleMarkScore(response, response.match[1], response.match[2]);
    });

    robot.hear(/^!mark (\w+) ((?: ?([+-][\d]+|w|win|winner|won|l|loss|lose|loser|lost|draw)( @?(\w+))?)+)\s*$/i, response => {
        this.handleMarkScore(response, response.match[1], response.match[2]);
    });
};
