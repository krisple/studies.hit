#include <stdio.h>
#include <stdlib.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <sys/sem.h>
#include <sys/types.h>
#include <unistd.h>
#include <sys/wait.h>

#define PROCESSES_NUMBER 100

void SemaphoreWait(int semid)
{
    struct sembuf sbuf = {0, -1, 0};
    semop(semid, &sbuf, 1);
}

void SemaphoreSignal(int semid)
{
    struct sembuf sbuf = {0, 1, 0};
    semop(semid, &sbuf, 1);
}

void CreateSharedMemory(int *shmid, int **sharedSum)
{
    *shmid = shmget(IPC_PRIVATE, sizeof(int), IPC_CREAT | 0666);
    if (*shmid == -1)
    {
        perror("shmget failed");
        exit(1);
    }

    *sharedSum = (int *)shmat(*shmid, NULL, 0);
    if (*sharedSum == (void *)-1)
    {
        perror("shmat failed");
        exit(1);
    }

    **sharedSum = 0;
}

void CreateSemaphore(int *semid)
{
    *semid = semget(IPC_PRIVATE, 1, IPC_CREAT | 0666);
    if (*semid == -1)
    {
        perror("semget failed");
        return;
    }

    if (semctl(*semid, 0, SETVAL, 1) == -1)
    {
        perror("semctl failed");
        return;
    }
}

void SharedMemoryCleanup(int shmid, int *sharedSum)
{
    shmdt(sharedSum);
    shmctl(shmid, IPC_RMID, NULL);
}

void SemaphoreCleanup(int semid)
{
    semctl(semid, 0, IPC_RMID);
}

int main()
{
    int shmid;
    int *sharedSum;
    int semid;

    CreateSharedMemory(&shmid, &sharedSum);

    CreateSemaphore(&semid);
    if (semid == -1)
    {
        perror("Semaphore creation failed");
        SharedMemoryCleanup(shmid, sharedSum);
        exit(1);
    }

    for (int i = 1; i <= PROCESSES_NUMBER; i++)
    {
        pid_t pid = fork();
        if (pid < 0)
        {
            perror("fork failed");
            exit(1);
        }

        if (pid == 0)
        {
            SemaphoreWait(semid);
            *sharedSum += i;
            SemaphoreSignal(semid);
            shmdt(sharedSum);
            exit(0);
        }
    }

    for (int i = 0; i < PROCESSES_NUMBER; i++)
    {
        wait(NULL);
    }

    printf("The sum from 1 to 100 is: %d\n", *sharedSum);

    SharedMemoryCleanup(shmid, sharedSum);
    SemaphoreCleanup(semid);

    return 0;
}
