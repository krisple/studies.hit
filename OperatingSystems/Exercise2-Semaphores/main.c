#include <sys/sem.h>  //semget, IPC_PRIVATE, IPC_CREAT, semctl, SETVAL, sembuf, semop
#include <stdio.h>    // printf, fflush, stdout
#include <stdlib.h>   // exit
#include <sys/wait.h> // wait
#include <unistd.h>   // fork

#define MAX_NUMBER 100
#define NUMBER_OF_PROCESSES 5

int CreateSemaphoreArray();
void InitSemaphoresArray(int semid);
void wait_custom(int semid, int sem_num);
void signal_custom(int semid, int sem_num);

int main()
{
    int cuurentPid = 0;

    int semid = CreateSemaphoreArray();

    InitSemaphoresArray(semid);

    for (int i = 0; i < NUMBER_OF_PROCESSES; ++i)
    {
        cuurentPid = fork();
        if (cuurentPid < 0)
        {
            perror("Error: Fork failed - Faild to run your command try again");
            exit(-1);
        }
        else if (0 == cuurentPid) // Child Code
        {
            for (int num = i + 1; num <= MAX_NUMBER; num += NUMBER_OF_PROCESSES)
            {
                wait_custom(semid, i);

                printf("%d\n", num);
                fflush(stdout);

                for (int j = 0; j < NUMBER_OF_PROCESSES; j++)
                {
                    if (j != i)
                    {
                        signal_custom(semid, j);
                    }
                }
            }

            exit(0);
        }
    }

    for (int i = 0; i < NUMBER_OF_PROCESSES; i++)
    {
        wait(NULL);
    }

    return 0;
}

int CreateSemaphoreArray()
{
    int semid = semget(IPC_PRIVATE, NUMBER_OF_PROCESSES, IPC_CREAT | 0666);
    if (semid == -1)
    {
        perror("semget failed");
        exit(1);
    }

    return semid;
}

void InitSemaphoresArray(int semid)
{
    for (int i = 0; i < NUMBER_OF_PROCESSES; ++i)
    {
        if (semctl(semid, i, SETVAL, NUMBER_OF_PROCESSES - 1 - i) == -1)
        {
            perror("semctl failed");
            exit(1);
        }
    }
}

void wait_custom(int semid, int sem_num)
{
    struct sembuf op = {sem_num, -4, 0};
    semop(semid, &op, 1);
}

void signal_custom(int semid, int sem_num)
{
    struct sembuf op = {sem_num, 1, 0};
    semop(semid, &op, 1);
}