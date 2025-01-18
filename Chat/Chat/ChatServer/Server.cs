using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace ChatServer
{
    public class Server
    {
        private readonly ConcurrentDictionary<string, Socket> _clients;
        private readonly Socket _socket;
        private readonly EndPoint _host;

        private const int _hostPort = 5740;
        private const string _hostIp = "127.0.0.1";


        public Server()
        {
            _clients = new ConcurrentDictionary<string, Socket>();
            _host = new IPEndPoint(IPAddress.Parse(_hostIp), _hostPort);
            _socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        }

        public void Start()
        {
            try
            {
                _socket.Bind(_host);
                _socket.Listen(50);

                Console.WriteLine($"Server started on port {_hostPort}. Waiting for connections...");

                while (true)
                {
                    DelegateNewChatClientToThread();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Connection error: \n {ex.Message}");
                _socket.Close();
            }
        }

        private void DelegateNewChatClientToThread()
        {
            Socket clientSocket = _socket.Accept();
            Thread clientThread = new Thread(() => HandleClient(clientSocket));
            clientThread.Start();
        }

        private void HandleClient(Socket clientSocket)
        {
            string clientName = string.Empty;
            try
            {
                byte[] buffer = new byte[1024];

                clientName = GetMessageFromClient(clientSocket, buffer);

                while (IsClientNameAlreadyTaken(clientName))
                {
                    clientSocket.Send(Encoding.UTF8.GetBytes("Name already taken."));
                    clientName = GetMessageFromClient(clientSocket, buffer);
                }

                _clients.TryAdd(clientName, clientSocket);

                Console.WriteLine($"{clientName} connected.");
                clientSocket.Send(Encoding.UTF8.GetBytes($"{clientName} welcome to the chat server!"));

                while (true)
                {
                    string message = GetMessageFromClient(clientSocket, buffer);
                    HandleClientMessage(clientSocket, message, clientName);
                }
            }
            catch (SocketException)
            {
                Console.WriteLine($"Client \"{clientName}\" disconnected.");
            }
            finally
            {
                RemoveClientFromClientsDict(clientSocket);
                clientSocket.Close();
            }
        }

        private string GetMessageFromClient(Socket clientSocket, byte[] buffer)
        {
            int receivedBytes = clientSocket.Receive(buffer);
            string response = Encoding.UTF8.GetString(buffer, 0, receivedBytes).Trim();

            return response;
        }

        private bool IsClientNameAlreadyTaken(string clientName)
        {
            return _clients.ContainsKey(clientName);
        }

        private void HandleClientMessage(Socket clientSocket, string message, string clientName)
        {
            if (message.StartsWith("/to"))
            {
                string[] parts = message.Split(' ', 3);
                if (parts.Length < 3)
                {
                    clientSocket.Send(Encoding.UTF8.GetBytes("Invalid command. Use /to <name> <message>"));
                    return;
                }

                string targetName = parts[1];
                string msg = parts[2].Trim();

                if (_clients.ContainsKey(targetName))
                {
                    _clients[targetName].Send(Encoding.UTF8.GetBytes($"{clientName}: {msg}"));
                }
                else
                {
                    clientSocket.Send(Encoding.UTF8.GetBytes($"User {targetName} not found."));
                }
            }
            else
            {
                clientSocket.Send(Encoding.UTF8.GetBytes("Invalid command. Use /to <name> <message>"));
            }
        }

        private void RemoveClientFromClientsDict(Socket clientSocket)
        {
            foreach (var client in _clients)
            {
                if (client.Value == clientSocket)
                {
                    _clients.TryRemove(client);
                    break;
                }
            }
        }
    }
}
