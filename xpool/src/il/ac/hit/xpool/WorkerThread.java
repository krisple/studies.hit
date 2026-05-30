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
    private Queue<Task> tasks;

    /**
     * Primary constructor for WorkerThread.
     * 
     * @param tasks The shared tasks queue to monitor and consume from.
     */
    public WorkerThread(Queue<Task> tasks) {
        super();
        setTasks(tasks);
    }

    /**
     * The main execution loop of the worker thread.
     * Continuously pulls tasks from the queue and performs them.
     */
    @Override
    public void run() {
        while (true) {
            Task taskToExecute = null;

            // Synchronize access while checking and polling the shared queue.
            synchronized (tasks) {
                while (tasks.isEmpty()) {
                    try {
                        // Wait while the queue is empty and release the monitor for submitting threads.
                        tasks.wait();
                    } catch (InterruptedException exception) {
                        // Restore the interrupt flag before terminating this worker.
                        Thread.currentThread().interrupt();
                        return;
                    }
                }

                taskToExecute = tasks.poll();
            }

            // Execute outside the synchronized block so other workers can retrieve tasks.
            if (taskToExecute != null) {
                performTask(taskToExecute);
            }
        }
    }

    /**
     * Returns a string representation of this worker thread.
     * 
     * @return A string representation of the worker thread.
     */
    @Override
    public String toString() {
        return "WorkerThread{name='" + getName() + "'}";
    }

    /**
     * Executes the given task and handles any potential runtime errors.
     * 
     * @param task The task to be performed.
     * @throws XPoolException if the task is null.
     */
    private void performTask(Task task) {
        if (task == null) {
            throw new XPoolException("Task cannot be null");
        }

        try {
            task.perform();
        }
        /*
         * Tasks are provided by external clients. Catching RuntimeException prevents
         * one failed task from terminating the worker thread.
         */
        catch (RuntimeException exception) {
            System.err.println("Exception occurred during task execution in worker " + this);
            exception.printStackTrace();
        }
    }

    /**
     * Sets the tasks queue for this worker.
     * 
     * @param tasks The queue to be assigned.
     * @throws XPoolException if the tasks queue is null.
     */
    private void setTasks(Queue<Task> tasks) {
        if (tasks == null) {
            throw new XPoolException("Tasks queue cannot be null");
        }
        this.tasks = tasks;
    }
}
