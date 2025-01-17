using System.Net;
using System.Net.Sockets;
using System.Text;

namespace ChatClient
{
    public class Client
    {
        private IPEndPoint _host;
        private Socket _socket;
        private string _name;

        private const int _hostPort = 5740;
        private const string _hostIp = "127.0.0.1";

        public Client()
        {
            _host = new IPEndPoint(IPAddress.Parse(_hostIp), _hostPort); 
            _socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
            _name = string.Empty;
        }

        public void Start()
        {
            try
            {
                byte[] buffer = new byte[1024];

                Console.WriteLine("welcome to chat service");
                _name = GetClientNameFromUser();

                _socket.Connect(_host);

                SendMessageToServer(_name);

                while (GetMessageFromServer(buffer) == "Name already taken.")
                {
                    SendMessageToServer(GetClientNameFromUser());
                }

                StartListenerThreadToServerMessages();

                StartChating();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Connection error: \n {ex.Message}");
                _socket.Close();
            }
        }

        private void SendMessageToServer(string message)
        {
            if (string.IsNullOrEmpty(message))
            {
                Console.WriteLine("Cant send empty message...");
            }

            _socket.Send(Encoding.UTF8.GetBytes(message));
        }

        private string GetMessageFromServer(byte[] buffer)
        {
            int receivedBytes = _socket.Receive(buffer);
            string response = Encoding.UTF8.GetString(buffer, 0, receivedBytes).Trim();
            Console.WriteLine(response);

            return response;
        }

        private void StartListenerThreadToServerMessages()
        {
            Thread receiveThread = new Thread(() => ReceiveMessages(_socket));
            receiveThread.Start();
        }

        private void StartChating()
        {
            Console.WriteLine("Enter messages (write exit for exit):");
            string currentMessage = Console.ReadLine();

            while (currentMessage != "exit")
            {
                SendMessageToServer(currentMessage);
                currentMessage = Console.ReadLine();
            }
        }

        private string GetClientNameFromUser()
        {
            Console.WriteLine("Enter your name:");
            string name = Console.ReadLine();

            while (string.IsNullOrEmpty(name))
            {
                Console.WriteLine("Invalid name, please enter your name again:");
                name = Console.ReadLine();
            }

            return name;
        }

        private void ReceiveMessages(Socket clientSocket)
        {
            try
            {
                byte[] buffer = new byte[1024];
                while (true)
                {
                    GetMessageFromServer(buffer);
                }
            }
            catch (SocketException)
            {
                Console.WriteLine("Disconnected from server.");
            }
            finally
            {
                clientSocket.Close();
            }
        }
    }
}
