import { Extension, HPacket, HDirection, GAsync, AwaitingPacket } from "gnode-api";
import fs from "fs";

const extensionInfo = {
	name: "PositionGo",
	description: "Go to saved room positions.",
	version: "1.0.1",
	author: "floppidity"
};
  
const ext = new Extension(extensionInfo);
const gAsync = new GAsync(ext);
ext.run();

let roomID = 0; // store room id on load

let positions = {};
if (fs.existsSync("./locations.json")) {
	positions = JSON.parse(fs.readFileSync("./locations.json", "utf8")); // load positions file
}
let posName = "";


function silentMsg(message) {
	ext.sendToClient(new HPacket(`{in:Chat}{i:-1}{s:"${message}"}{i:0}{i:23}{i:0}{i:-1}`));
}

function savePos(rid, name, x, y) {
    positions[rid] = {
        ...(positions[rid] || {}),
        [name]: {
            'x': x,
            'y': y
        }
    };

    fs.writeFileSync("./locations.json", JSON.stringify(positions, null, 2), "utf8");
    silentMsg(`Saved position \n${name} in room ${rid}.`);
    posName = "";
}

ext.interceptByNameOrHash(HDirection.TOSERVER, "Chat", hMsg => {
	const args = hMsg.getPacket().readString().split(" ");

	hMsg.blocked = true;

	switch(args[0].toLowerCase()) {
		case "/save":
			saveTile(args[1]);
			break;
		case "/load":
			loadTile(args[1]);
			break;
		case "/reload":
			reloadRoom();
			break;
		case "/help":
			sendHelpMessage();
			break;
		default:
			hMsg.blocked = false;
			break;
	}
});

async function saveTile(name) {
	if (!name) return silentMsg("Please specify a position name.");
	if (roomID == 0) return silentMsg("Please reload the room");

	silentMsg("Click on the tile you want to save.");

	let movementPacket = await gAsync.awaitPacket(new AwaitingPacket("MoveAvatar", HDirection.TOSERVER, 30000, true));

	if (movementPacket == null) return silentMsg("You haven't clicked a tile in 30 seconds, save cancelled!");

	savePos(roomID, name, ...movementPacket.read('ii'));
}

function loadTile(name) {
	if (!name) return silentMsg("Please specify a position name.");
	if (roomID == 0) return silentMsg("Please reload the room");

	let position = positions[roomID] ? positions[roomID][name] : undefined;
	if (!position) return silentMsg(`Position name ${name} in this room does not exist.\nUse /help.`);

	ext.sendToServer(new HPacket(`{out:MoveAvatar}{i:${position.x}}{i:${position.y}}`));
}

function reloadRoom() {
	ext.sendToServer(new HPacket("{out:GetHeightMap}"));
}

function sendHelpMessage() {
	silentMsg("Commands:\n/save [name] - save position\n/load [name] - load position\n/reload - reload room\n/help - show this message");
}

// {out:GetGuestRoom}{i:78366729}{i:0}{i:1}
ext.interceptByNameOrHash(HDirection.TOSERVER, "GetGuestRoom", hRoom => {
	const packet = hRoom.getPacket();
	roomID = packet.readInteger();
	silentMsg(`RoomID stored: ${roomID}`);
});

ext.on("connect", () => {
	ext.sendToClient(new HPacket(`{in:NotificationDialog}{s:\"\"}{i:3}{s:\"display\"}{s:\"BUBBLE\"}{s:\"message\"}{s:\"PositionGo loaded. Use /help for commands.\"}{s:\"image\"}{s:\"https://raw.githubusercontent.com/iUseYahoo/G-ExtensionStore/repo/1.5.2/store/extensions/PositionGo/icon.png\"}`));
});
