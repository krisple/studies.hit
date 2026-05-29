package il.ac.hit.xpool;

import java.util.Queue;

/**
 * A worker thread that consumes and executes tasks from a shared priority
 * queue.
 * The thread waits when the queue is empty and processes tasks one by one.
 */
public class WorkerThread extends Thread {

    /**
     * The shared queue from which tasks are retrieved.
     */
    private Queue<Task> tasksQueue;

    /**
     * Primary constructor for WorkerThread.
     * 
     * @param queue The shared tasks queue to monitor and consume from.
     */
    public WorkerThread(Queue<Task> queue) {
        super();

        // Validating and assigning final tasksQueue field
        if (queue == null) {
            throw new XPoolException("Tasks queue cannot be null");
        }
        setTasksQueue(queue);
    }

    /**
     * Sets the tasks queue for this worker.
     * * @param queue The queue to be assigned.
     */
    private void setTasksQueue(Queue<Task> queue) {
        this.tasksQueue = queue;
    }

    /**
     * The main execution loop of the worker thread.
     * Continuously pulls tasks from the queue and performs them.
     */
    @Override
    public void run() {
        while (true) {
            Task taskToExecute = null;

            // acquiring the lock to safely retrieve the next task
            synchronized (tasksQueue) {
                while (tasksQueue.isEmpty()) {
                    try {
                        // waiting for a notification that a new task has arrived
                        tasksQueue.wait();
                    } catch (InterruptedException e) {
                        // restoring interrupted status and exiting loop if necessary
                        Thread.currentThread().interrupt();
                        return;
                    }
                }

                // extracting the highest priority task
                taskToExecute = tasksQueue.poll();
            }

            // executing the task outside the synchronized block to avoid blocking the queue
            if (taskToExecute != null) {
                performTask(taskToExecute);
            }
        }
    }

    /**
     * Executes the given task and handles any potential runtime errors.
     * 
     * @param task The task to be performed.
     */
    private void performTask(Task task) {
        try {
            task.perform();
        } catch (RuntimeException e) {
            System.err.println("Exception occurred during task execution in worker " + getName());
            e.printStackTrace();
        }
    }
}
