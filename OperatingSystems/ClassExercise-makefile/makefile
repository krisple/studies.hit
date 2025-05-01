CC = gcc
CFLAGS = -Wall -Wextra
EXECUTABLE_FILE = string_program
OBJS = main.o string_utils.o

all: $(EXECUTABLE_FILE)

$(EXECUTABLE_FILE): $(OBJS)
	$(CC) $(CFLAGS) -o $(EXECUTABLE_FILE) $(OBJS)

main.o: main.c string_utils.h
	$(CC) $(CFLAGS) -c main.c

string_utils.o: string_utils.c string_utils.h
	$(CC) $(CFLAGS) -c string_utils.c

clean:
	rm -f $(EXECUTABLE_FILE) $(OBJS)