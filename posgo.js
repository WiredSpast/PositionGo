import { Extension, HPacket, HDirection, HMessage } from "gnode-api";
import fs from "fs";

const extensionInfo = {
	name: "PositionGo",
	description: "Go to saved room positions.",
	version: "1.0.0",
	author: "floppidity"
};
  
let ext = new Extension(extensionInfo);
ext.run();

let roomID = 0; // store room id on load
let status = false;
let positions = JSON.parse(fs.readFileSync("./locations.json", "utf8")); // load positions file
console.log(positions);
let posName = "";


function silentMsg(message) {
	ext.sendToClient(new HPacket(`{in:Chat}{i:-1}{s:"${message}"}{i:0}{i:23}{i:0}{i:-1}`))
}

function savePos(rid, name, x, y) {
	positions[rid] = {
		[name]: {
			'x': x,
			'y': y
		}
	}

	fs.writeFileSync("./locations.json", JSON.stringify(positions, null, 2), "utf8");
	silentMsg(`Saved position \n${name} in room ${rid}.`);
	posName = "";
}

ext.interceptByNameOrHash(HDirection.TOSERVER, "Chat", hMsg => {
	const packet = hMsg.getPacket();
	const message = packet.readString();
	let args = message.split(" ");

	if (args[0].toLowerCase() === "/save") {
		hMsg.blocked = true;

		if (!args[1]) return silentMsg("Please specify a name for the position.");
		if (roomID == 0) return silentMsg("Please reload the room.");

		silentMsg("Click on the tile you want to save.");

		posName = args[1];
		status = true;
	}

	if (args[0].toLowerCase() === "/load") {
		hMsg.blocked = true;

		if (!args[1]) return silentMsg("Please specify a position name.");
		if (roomID == 0) return silentMsg("Please reload the room.");
		
		if (!positions[roomID]) return silentMsg(`No positions are saved in this room.\nUse /help.`);
		if (!positions[roomID][args[1]]) return silentMsg(`Position name ${args[1]} in this room does not exist.\nUse /help.`);

		let posName = args[1];
		let xPos = positions[roomID][posName].x;
		let yPos = positions[roomID][posName].y;

		ext.sendToServer(new HPacket(`{out:MoveAvatar}{i:${xPos}}{i:${yPos}}`));
	}

	if (args[0].toLowerCase() === "/reload") {
		hMsg.blocked = true;

		if (roomID == 0) return silentMsg("Please reload the room to get the room id.");

		ext.sendToServer(new HPacket(`{out:GetGuestRoom}{i:${roomID}}{i:0}{i:1}`));
	}

	if (args[0].toLowerCase() === "/help") {
		hMsg.blocked = true;

		silentMsg("Commands:\n/save [name] - save position\n/load [name] - load position\n/reload - reload room\n/help - show this message");
	}
})


// {out:GetGuestRoom}{i:78366729}{i:0}{i:1}
ext.interceptByNameOrHash(HDirection.TOSERVER, "GetGuestRoom", hRoom => {
	const packet = hRoom.getPacket();
	roomID = packet.readInteger();
	silentMsg(`RoomID stored: ${roomID}`);
})


ext.interceptByNameOrHash(HDirection.TOSERVER, "MoveAvatar", hPos => {
	const packet = hPos.getPacket();
	
	if (status == true) {
		const x = packet.readInteger();
		const y = packet.readInteger();

		status = false;
		savePos(roomID, posName, x, y);
	} 
})

ext.on("connect", () => {
	silentMsg("PositionGo loaded.\nUse /help for commands.");
})