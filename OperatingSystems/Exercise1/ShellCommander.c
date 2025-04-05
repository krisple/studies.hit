#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>

#define INPUT_SIZE 1000
#define MAX_PATH_LENGTH 1000
#define COMMAND_MAX_ARGS 64

#define TRUE 1
#define FALSE 0

enum errors
{
    PATH_NOT_FOUND = 1,
    EMPTY_COMMAND = 2,
    COMMAND_NOT_FOUND = 3
};

char *GetEnvironmentVariable(char *varName);
char *GetCommandFromUser();
void HandleLeaveCommand(char *input);
void TryToExecuteUserCommand(char *input, char *pathEnv);

int main()
{
    char *pathEnv = GetEnvironmentVariable("PATH");
    int pid = 0;
    int childStatus = 0;

    while (TRUE)
    {
        char *command = GetCommandFromUser();
        if (command == NULL)
        {
            continue;
        }

        HandleLeaveCommand(command);

        pid = fork();
        if (pid < 0)
        {
            perror("Error: Fork failed - Faild to run your command try again");
            free(command);
            continue;
        }
        if (0 == pid) // Child Code
        {
            TryToExecuteUserCommand(command, pathEnv);
        }
        else // Parent Code
        {
            wait(&childStatus);
        }

        free(command);
    }

    return 0;
}

char *GetEnvironmentVariable(char *varName)
{
    char *pathEnv = getenv(varName);
    if (NULL == pathEnv || 0 == strlen(pathEnv))
    {
        fprintf(stderr, "Error: %s environment variable not found or empty\n", varName);
        exit(PATH_NOT_FOUND);
    }
    return pathEnv;
}

char *GetCommandFromUser()
{
    char *command = malloc(INPUT_SIZE);
    if (command == NULL)
    {
        perror("Error: Memory allocation failed");
        return NULL;
    }

    printf("Enter Cmd:\n");
    if (NULL == fgets(command, INPUT_SIZE - 1, stdin))
    {
        perror("Error: Failed to get command from user");
        free(command);
        return NULL;
    }

    command[strcspn(command, "\n")] = 0;
    if (0 == strlen(command))
    {
        free(command);
        return NULL;
    }

    return command;
}

void HandleLeaveCommand(char *command)
{
    if (strcasecmp(command, "leave") == 0)
    {
        printf("Good Bye\n");
        exit(0);
    }
}

void TryToExecuteUserCommand(char *input, char *pathEnv)
{
    char pathCopy[MAX_PATH_LENGTH] = {0};
    char *libraryToken = NULL;
    char *args[COMMAND_MAX_ARGS] = {NULL};
    char tryCmd[MAX_PATH_LENGTH] = {0};
    char commandCopy[INPUT_SIZE] = {0};

    strncpy(commandCopy, input, INPUT_SIZE - 1);
    char *token = strtok(commandCopy, " ");
    if (token == NULL)
    {
        fprintf(stderr, "Error: Empty command\n");
        exit(EMPTY_COMMAND);
    }

    args[0] = token;

    int arg_count = 1;
    while ((token = strtok(NULL, " ")) != NULL && arg_count < COMMAND_MAX_ARGS - 1)
    {
        args[arg_count] = token;
        ++arg_count;
    }
    args[arg_count] = NULL;

    strncpy(pathCopy, pathEnv, MAX_PATH_LENGTH - 1);
    libraryToken = strtok(pathCopy, ":");

    while (libraryToken)
    {
        tryCmd[0] = 0;

        strcat(tryCmd, libraryToken);
        strcat(tryCmd, "/");
        strcat(tryCmd, args[0]);

        execv(tryCmd, args);

        libraryToken = strtok(NULL, ":");
    }

    fprintf(stderr, "Error: Command not found: %s\n", args[0]);
    exit(COMMAND_NOT_FOUND);
}