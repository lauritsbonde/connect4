const express = require("express");
const app = express();
const serv = require("http").Server(app);
const io = require('socket.io')(serv,{});
const mysql = require('mysql');

serv.listen(2020);
console.log("Server is running..");

//Connect to db
const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: '4row',
    port: '8889',
});

con.connect((err) => {
    if(err){
        console.error(err);
    } else {
        console.log("DB connected");
    }
});


app.use(express.static('public'));

/*
@@@@
@@@@
    SOCKET COMMUNICATION
@@@@
@@@@
*/
io.on('connection', socket => {
    //
    // SOCKET FOR CREATION
    //
    let error = false;
    let errorMsg = "";
    socket.on("createRoom", (data) => {
        let response = "";
        // calling the function, then waiting for all the mysql returns, then setting response to the returned value
        roomCreationStuff(data).then((value) => {
            response = value;
            //console.log(response);
            if(response == "allgood"){
                //join room
                socket.join(data.roomId);
                socket.emit("response", {
                    status: "tiptop", 
                    type: "created",
                    roomid: data.roomId
                });
                //console.log(data);
                socket.broadcast.emit("newRoom", {
                    roomid: data.roomId,
                    password: data.password
                })
                addToGameDb(data.roomId, "created", "the room was created", "player1");
            }
        }).catch(function(err){
            console.error(err);
            error = true;
            socket.emit("erorr", "Room already exists");
        })
    })

    //
    // SOCKET FOR GETTING ALL ROOMS
    //
    getAllRooms().then((result) => {
        socket.emit('allRooms', result);
    }). catch((err) => {
        console.log(err);
    })

    //
    // SOCKET FOR JOINING
    //
    socket.on("joinRoom", (data) => {
        checkActiveRooms(data.roomId).then((res) => {
            if(res[0].open == 1 && data.password == res[0].password){
                // room is open for another player and ready to be joined dammit! :)
                addToGameDb(data.roomId, "joined", "player 2 joined", "player2");
                updateActiveRoomToClosed(data.roomId).then(() => {
                    socket.join(data.roomId);
                    socket.emit('response', {
                        status: "tiptop",
                        type: "joined",
                        roomid: data.roomId,
                    })
                }).catch((err) => {
                    console.log(err);
                })
            } else {
                //yeah the opposite of the if
            }
        }).catch((err)=>{
            console.log(err);
        })
        io.to(data.roomId).emit("joined", "gamewasjoined");
    })

    socket.on("playerReady", (data) => {
        io.to(data.room).emit("playerIsReady", data.player);
        addToGameDb(data.room, "ready", data.player + " is ready again", data.player);
    })
    //
    // SOCKET FOR STAYING IN ROOM ON RECONNECT
    //
    socket.on("rejoin", (data)=>{
        socket.join(data.rejoin);
        addToGameDb(data.rejoin, "Rejoined", "player "+data.playerNum+" rejoined", data.playerNum);
        let allchatsSql = "SELECT * FROM " + data.rejoin + " WHERE event = 'chat'";
        con.query(allchatsSql, (err, result) => {
            let chatRes = result;
            if(err){
                chatRes = "Der skete en fejl med chatsne";
            }
            socket.emit("response", {
                status: "tiptop",
                type: "rejoin",
                roomid: data.rejoin,
                chat: chatRes
            })
        })
    })
    
    //
    // SOCKET FOR LEAVING ROOM
    //
    socket.on("leave", (data)=>{
        addToGameDb(data.room, "left", "player "+data.player+" left the game", data.player)
        socket.leave(data.room);
    })

    //
    // SOCKET FOR GAME MECHANICS
    //
    socket.on("brickplaced", (data) => {
        if(data.roomid != "singleplayer"){
            addToGameDb(data.roomid, "brick placed", "col" + data.placeCol + " | row" + data.placeRow + ".", data.game.turn);
        }
        let updatedGame = updateGame(data.game, data.roomid, data.placeCol, data.placeRow);
        //console.log(updatedGame);
        if(data.roomid != "singleplayer"){
            io.to(data.roomid).emit("gameRes", updatedGame);
        } else {
            socket.emit("gameRes", updatedGame);
        }
    })

    // 
    // SOCKET FOR SENDING CHATS
    //
    socket.on("chatMsg", (data) => {
        addToGameDb(data.room, "chat", data.msg, data.player);
        //emit response
        io.to(data.room).emit("chatRes", {
            player: data.player,
            msg: data.msg,
        });
    })

});

/*
@@@@
@@@@
    FOR ROOM CREATION STUFF
@@@@
@@@@
*/

function roomCreationStuff(data){
    return new Promise((resolve, reject) => {
        checkRoomExist(data.roomId).then(() =>{
            // roomdoes not exist 
            createRoom(data.roomId).then(() => {
                addToActiveRooms(data).then(() =>{
                    // created 
                    resolve("allgood");
                }).catch(() => {
                    reject("notAddedToActive");
                })
            }).catch(() =>{
                 // error during creating room
                reject("roomnotcreated");
            });
        }).catch(() => {
             // exists
            reject("roomexists");
        });
    }) ;
}

function checkRoomExist(roomid){
    //TODO: maybe change this to check in activerooms
    let existsql = "SELECT * FROM " + roomid;
    return new Promise((resolve, reject) => {
        con.query(existsql, function (err, result) {
            try {
                if (err.code == "ER_NO_SUCH_TABLE") {
                    //Room does not exist
                    //createRoom(roomid);
                    resolve("doesnotexist");
                }
            } catch (err){
                //room exists
                reject("shite");
            }
        })
    })
}

function createRoom(roomid){
    let sql = "CREATE TABLE "+ roomid +" (id INT AUTO_INCREMENT PRIMARY KEY, event VARCHAR(255), message VARCHAR(255), player VARCHAR(255), time DATETIME(6))";
    return new Promise((resolve, reject) => {
        con.query(sql, function (err, result){
            if(err) {
                reject("err");
            } else {
                resolve("created");
            }
        })
    })
}

/*
@@@@
@@@@
    FOR ALTERING GENERAL DATABASES
@@@@
@@@@
*/

function addToGameDb(roomid, event, message, player){
    let time = new Date().toLocaleString();
    let sql = "INSERT into " + roomid + " (event, message, player, time) VALUES ('" + event + "', '"+message+"', '" + player + "', '"+ time + "')";
    con.query(sql, function(err, results){
        if(err){
            console.log(err);
        } else {
            //console.log(results);
        }
    })
}

function addToActiveRooms(data){
    let time = new Date().toLocaleString();
    let sql = "INSERT INTO activerooms(roomid, time, password) VALUES ('"+data.roomId+"', '"+time+"', '"+data.password+"')";
    return new Promise((resolve, reject) => {
        con.query(sql, function(err, result){
            if(err){
                console.log(err);
                reject("sqlerr");
            } else {
                resolve("inserted");
            }
        })
    })
}

function updateActiveRoomToClosed(roomid){
    let time = new Date().toLocaleString();
    let sql = "UPDATE activerooms SET open = '0' WHERE roomid = '" + roomid + "'";
    return new Promise((resolve, reject) => {
        con.query(sql, function(err, result){
            if(err){
                console.log(err);
                reject("sqlerr");
            } else {
                resolve("updated");
            }
        })
    })
}

/*
@@@@
@@@@
    FOR GETTING ALL ROOMS
@@@@
@@@@
*/

function getAllRooms(){
    const sql = "SELECT * FROM activerooms WHERE open = '1'";
    return new Promise((resolve, reject) => {
        con.query(sql, function(err, result){
            if(err){
                console.log(err);
                reject("sqlError");
            } else {
                resolve(result);
            }
        })
    })
}

/*
@@@@
@@@@
    FOR JOINING ROOM STUFF
@@@@
@@@@
*/

function checkActiveRooms(roomid){
    let sql = "SELECT * FROM activerooms WHERE roomid = '"+ roomid + "'";
    return new Promise((resolve, reject) => {
        con.query(sql, function(err, res){
            if(err) {
                console.log(err);
                reject("sqlError");
            } else {
                //console.log(res);
                resolve(res);
            }
        })
    })
}

/*
@@@@
@@@@
    FOR GAME MECHANICS
@@@@
@@@@
*/

//TODO: update board array and send to both players
//TODO: check for win
function updateGame(game, roomid, placeCol, placeRow){
    let gamestate = game;
    // updateboard
    // updateBoard(gamestate.board);
    let winArray = checkForWin(gamestate.turn, gamestate.board, gamestate.columns, gamestate, placeCol, placeRow);
    if(winArray.length > 0){
        gamestate.whoWon = winArray[0][2];
        gamestate.player1ready = false;
        gamestate.player2ready = false;
    }
    if(gamestate.whoWon == 1){
        gamestate.isDone = true;
        gamestate.points[0] += 1;
        gamestate.winArray = winArray;
        if(roomid != "singleplayer"){
            addToGameDb(roomid, "WINNER", "player 1 won", "1");
        }
    } else if (gamestate.whoWon== 2){
        gamestate.isDone = true;
        gamestate.points[1] += 1;
        gamestate.winArray = winArray;
        if(roomid != "singleplayer"){
            addToGameDb(roomid, "WINNER", "player 2 won", "2");
        }
    }
    //console.log(gamestate);
    // do this last
    gamestate.turn = changeturn(gamestate.turn);
    return gamestate;
}

//! might be useless :)
function updateBoard(board){
// well it is updated from the socket?
}

//board[0] er nedad dvs. vertikalt

function checkForWin(player, board, columns, gamestate, placeCol, placeRow){
    let verwin = [];
    //this checks the vertical vin = ⬇
    if(placeRow < 4){
        for(let i = placeRow-1; i < placeRow + 3; i++){
            if(board[placeCol-1][i] === player && !verwin.includes([placeCol, i, player])) {
                verwin.push([placeCol, i+1, player]);
            } else {
                verwin.splice(0, verwin.length);
            }
            if(verwin.length >= 4){
                //console.log("verwin " + verwin);
                return verwin;
            }
        }
    }


    //this checks the horizontal win = ➡
    let horwin = [];
    for(let i = 0; i < board.length; i++){
        if(board[i][placeRow-1] == player && !horwin.includes([i + 1, placeRow, player])){
            horwin.push([i + 1, placeRow, player]);
        } else {
            horwin.splice(0, horwin.length);
        }
        if(horwin.length >= 4){
            //console.log("horwin " + horwin);
            return horwin;
        }
    }

    //chechks one diagonal = ↗️
    let diaStartCol = placeCol-1;
    let diaStartRow = placeRow-1; 
    let findStart = true;

    let diaplaces = [];

    //first im gonna find the places to the left and down from the place
    while(findStart ){
        if (diaStartCol <= 0 || diaStartRow >= 5){
            findStart = false;
        } else {
            diaStartCol--;
            diaStartRow++;
            diaplaces.unshift([diaStartCol, diaStartRow]);
        }
    }

    //then i insert the place of the placed brick
    diaplaces.push([placeCol-1, placeRow-1]);

    let findend = true;
    let diaEndcol = placeCol-1;
    let diaEndrow = placeRow-1;

    //then im fonna find the places to the right and up
    while(findend){
        if(diaEndcol >= 7 || diaEndrow <= 0){
            findend = false;
        } else {
            diaEndcol++;
            diaEndrow--;
            diaplaces.push([diaEndcol, diaEndrow]);
        }
    }
    
    //check the places for streak
    let diaWin = [];
    if(diaplaces.length > 0){
        for(let i = 0; i < diaplaces.length; i++){
            if(board[diaplaces[i][0]][diaplaces[i][1]] == player){
                diaWin.push([diaplaces[i][0]+1, diaplaces[i][1]+1, player]);
            } else {
                diaWin.splice(0, diaWin.length);
            }
            if(diaWin.length >= 4){
                return diaWin;
            }
        }
    }

    //checks for the other diagonal ↖️
    let otherdiaStartCol = placeCol-1;
    let otherdiaStartRow = placeRow-1; 
    let otherfindStart = true;

    let otherdiaplaces = [];
    
    //first im finding the places to the left and up of placement
    while(otherfindStart ){
        if (otherdiaStartCol <= 0  || otherdiaStartRow <= 0){
            otherfindStart = false;
        } else {
            otherdiaStartCol--;
            otherdiaStartRow--;
            otherdiaplaces.unshift([otherdiaStartCol, otherdiaStartRow]);
        }
    }
    
    //then i insert the placement og the brick
    otherdiaplaces.push([placeCol-1, placeRow-1]);

    //then i find the places to the right and down from placement
    let otherfindend = true;
    let otherdiaEndcol = placeCol-1;
    let otherdiaEndrow = placeRow-1;
    while(otherfindend){
        if(otherdiaEndcol >= 7 || otherdiaEndrow >= 5){
            otherfindend = false;
        } else {
            otherdiaEndcol++;
            otherdiaEndrow++;
            otherdiaplaces.push([otherdiaEndcol, otherdiaEndrow]);
        }
    }

    //checking for a streak
    let otherdiaWin = [];
    if(otherdiaplaces.length > 0){
        for(let i = 0; i < otherdiaplaces.length; i++){
            if(board[otherdiaplaces[i][0]][otherdiaplaces[i][1]] == player){
                otherdiaWin.push([otherdiaplaces[i][0]+1, otherdiaplaces[i][1]+1, player]);
            } else {
                otherdiaWin.splice(0, otherdiaWin.length);
            }
            if(otherdiaWin.length >= 4){
                return otherdiaWin;
            }
        }
    }
    
    //return nothing for no wins
    return "";
}

//change turn --- modulo makes it go around because 1%2 = 1 + 1 = 2 and 2%2 = 0 + 1 = 1
function changeturn(turn){
    return (turn%2) + 1;
}