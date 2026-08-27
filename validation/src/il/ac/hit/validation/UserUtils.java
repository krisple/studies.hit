package il.ac.hit.validation;

import java.util.Arrays;
import java.util.Comparator;

/**
 * Utility class providing common operations on User arrays.
 */
public class UserUtils {

/*
 * The sort operation follows the Template Method approach required by the project.
 * Arrays.sort provides the fixed sorting workflow, while the supplied Comparator
 * provides the variable comparison behavior.
 */

    /**
     * Sorts an array of users using the provided comparator.
     *
     * @param users      the array of users to be sorted
     * @param comparator the comparison functionality to determine the order
     * @throws ValidationException if the users array or comparator is null
     */
    public static void sort(User[] users, Comparator<User> comparator) {
        // Validate both inputs before delegating the sorting operation.
        if (users == null) {
            throw new ValidationException("Users array cannot be null.");
        }
        if (comparator == null) {
            throw new ValidationException("Comparator cannot be null.");
        }

        // The supplied Comparator defines the ordering strategy for the users.
        Arrays.sort(users, comparator);
    }
}
