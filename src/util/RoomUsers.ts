import { Socket } from "socket.io";

export default class RoomUsers {

  private usersInRooms = new Map<string,Map<string,string>>()
  
  /**
   * User joins given room.
   * @param talkId Room talk id
   * @param socket Socket
   * @param username Username
   * @returns All users in the room (including the joiner)
   */
  public joinsRoom(talkId: string, socket: Socket, username: string) : string[] {
    const usersInRoom = this.getUsersInRoom(talkId)
    usersInRoom.set(socket.id, username)
    return Array.from(usersInRoom.values())
  }

  /**
   * User leaves given room.
   * @param talkId Room talk id
   * @param socket Socket
   * @returns All users in the room (excluding the leaver)
   */
  public leavesRoom(talkId: string, socket: Socket) : string[] {
    const usersInRoom = this.getUsersInRoom(talkId)
    usersInRoom.delete(socket.id)
    return Array.from(usersInRoom.values())
  }

  /**
   * User disconnects and will leave all open rooms
   * @param socket Socket
   * @return Room talk ids user was part in.
   */
  public disconnected(socket: Socket) : {talkId: string, usernames: string[]}[] {
    const result : {talkId: string, usernames: string[]}[] = []
    Array.from(this.usersInRooms.entries())
        .filter(([, usersInRoom]) => usersInRoom.has(socket.id))
        .forEach(([talkId]) => result.push({ talkId, usernames: this.leavesRoom(talkId, socket) }))
    return result
  }

  private getUsersInRoom(talkId: string) : Map<string,string> {
    let usersInRoom = this.usersInRooms.get(talkId)
    if (!usersInRoom) {
      usersInRoom = new Map<string,string>()
      this.usersInRooms.set(talkId, usersInRoom)
    }
    return usersInRoom
  }
  
}
